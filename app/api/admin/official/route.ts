import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

const OFFICIAL_NICK = "vetoks_official";
const OFFICIAL_NAME = "VETOKS_OFFICIAL";

async function staffCountries(uid: string): Promise<string[] | null> {
  const { data } = await supabaseAdmin.from("users").select("role, staff_countries").eq("id", uid).maybeSingle();
  if (data?.role === "super_admin") return null;
  return Array.isArray(data?.staff_countries) ? (data!.staff_countries as string[]) : null;
}

async function officialOf(countryId: string) {
  const { data: regs } = await supabaseAdmin.from("regions").select("id").eq("country_id", countryId);
  const ids = (regs ?? []).map((r: any) => r.id);
  if (!ids.length) return null;
  const { data } = await supabaseAdmin.from("users").select("id, first_name, photo_url").eq("is_official", true).in("region_id", ids).limit(1).maybeSingle();
  return data as { id: string; first_name: string | null; photo_url: string | null } | null;
}

// Официальные аккаунты VETOKS по странам: создание и публикации от их имени.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const allowed = await staffCountries(uid);
  const okCountry = (c: string) => !allowed || allowed.includes(c);

  if (action === "list") {
    const { data: cs } = await supabaseAdmin.from("countries").select("id, name").order("name");
    const items = [];
    for (const c of (cs ?? []) as { id: string; name: string }[]) {
      if (!okCountry(c.id)) continue;
      const off = await officialOf(c.id);
      items.push({ countryId: c.id, country: c.name, officialId: off?.id ?? null, photoUrl: off?.photo_url ?? null });
    }
    return NextResponse.json({ ok: true, items });
  }

  const countryId = String(b.countryId || "");
  if (!countryId || !okCountry(countryId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (action === "create") {
    if (await officialOf(countryId)) return NextResponse.json({ ok: true, exists: true });
    const { data: reg } = await supabaseAdmin.from("regions").select("id").eq("country_id", countryId).order("name").limit(1).maybeSingle();
    if (!reg) return NextResponse.json({ ok: false, error: "no_regions" }, { status: 409 });
    const { data: country } = await supabaseAdmin.from("countries").select("code, name").eq("id", countryId).maybeSingle();
    const tag = String((country as any)?.code ?? countryId.slice(0, 6)).toLowerCase().replace(/[^a-z0-9]/g, "");
    // Войти в этот аккаунт нельзя: пароль случайный и никому не известен.
    const { data: au, error } = await supabaseAdmin.auth.admin.createUser({
      email: `official-${tag}-${randomBytes(3).toString("hex")}@official.vetoks.app`,
      password: randomBytes(24).toString("hex"),
      email_confirm: true,
    });
    if (error || !au?.user) return NextResponse.json({ ok: false, error: "server", detail: error?.message }, { status: 500 });
    const { error: insErr } = await supabaseAdmin.from("users").insert({
      id: au.user.id,
      first_name: OFFICIAL_NAME,
      nick: OFFICIAL_NICK,
      role: "viewer",
      region_id: reg.id,
      is_official: true,
      verified_badge: true,
      bio: "Официальная страница VETOKS",
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(au.user.id);
      return NextResponse.json({ ok: false, error: "server", detail: insErr.message }, { status: 500 });
    }
    // Все люди этой страны подписываются автоматически.
    await supabaseAdmin.rpc("vt_official_backfill", { p_official: au.user.id });
    await logAction(uid, "official_create", au.user.id, { countryId });
    return NextResponse.json({ ok: true, officialId: au.user.id });
  }

  const off = await officialOf(countryId);
  if (!off) return NextResponse.json({ ok: false, error: "no_official" }, { status: 404 });

  if (action === "post") {
    const url = String(b.url || "");
    const kind = b.kind === "video" ? "video" : "photo";
    if (!url.startsWith("http")) return NextResponse.json({ ok: false, error: "bad_url" }, { status: 400 });
    const { error } = await supabaseAdmin.from("content_posts").insert({
      participant_id: null,
      user_id: off.id,
      platform: "vetoks",
      media_type: kind,
      video_url: kind === "video" ? url : null,
      photo_url: kind === "photo" ? url : null,
      caption: String(b.caption || "").slice(0, 500),
      is_verified: true,
    });
    if (error) return NextResponse.json({ ok: false, error: "server", detail: error.message }, { status: 500 });
    await logAction(uid, "official_post", off.id, { countryId, kind });
    return NextResponse.json({ ok: true });
  }

  if (action === "posts") {
    const { data } = await supabaseAdmin
      .from("content_posts")
      .select("id, media_type, video_url, photo_url, caption, created_at")
      .eq("user_id", off.id)
      .order("created_at", { ascending: false })
      .limit(30);
    return NextResponse.json({ ok: true, items: data ?? [], officialId: off.id });
  }

  if (action === "delete") {
    await supabaseAdmin.from("content_posts").delete().eq("id", String(b.postId || "")).eq("user_id", off.id);
    await logAction(uid, "official_delete_post", off.id, { postId: b.postId });
    return NextResponse.json({ ok: true });
  }

  if (action === "photo") {
    const url = String(b.url || "");
    if (!url.startsWith("http")) return NextResponse.json({ ok: false, error: "bad_url" }, { status: 400 });
    await supabaseAdmin.from("users").update({ photo_url: url }).eq("id", off.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
