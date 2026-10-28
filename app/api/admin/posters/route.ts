import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { regionIdsOfCountry, countryOfUser } from "@/lib/countryServer";
import { POSTER_CATS, POSTER_CAT_LABEL, posterChats, posterKey, sendPosterToTg, sendTgText } from "@/lib/posterServer";

export const dynamic = "force-dynamic";

// CRM → «Афіші»: список готовых афиш, куда они уходят и повторная отправка.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  const cid = String(b.countryId ?? "").slice(0, 64);
  if (!cid && b.action !== "resend") return NextResponse.json({ ok: false, error: "Выберите страну вверху CRM." });

  if (b.action === "list") {
    let q = supabaseAdmin
      .from("participant_posters")
      .select("id, user_id, name, city, age_category, image_url, height_cm, bad_cutout, sent_tg, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    const cat = String(b.cat || "");
    if ((POSTER_CATS as readonly string[]).includes(cat)) q = q.eq("age_category", cat);
    const { data } = await q;
    // Только афиши людей этой страны.
    const regionSet = new Set(await regionIdsOfCountry(cid));
    const rows = (data ?? []) as any[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id as string)));
    const mine = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: us } = await supabaseAdmin.from("users").select("id, region_id").in("id", ids.slice(i, i + 200));
      ((us ?? []) as any[]).forEach((u) => u.region_id && regionSet.has(u.region_id) && mine.add(u.id));
    }
    return NextResponse.json({ ok: true, items: rows.filter((r) => mine.has(r.user_id)).slice(0, 200), chats: await posterChats(cid), labels: POSTER_CAT_LABEL });
  }

  if (b.action === "set_chats") {
    const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
    if ((me as any)?.role !== "super_admin") return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    const chats = (b.chats ?? {}) as Record<string, string>;
    for (const c of POSTER_CATS) {
      const v = String(chats[c] ?? "").trim().slice(0, 100);
      await supabaseAdmin.from("platform_settings").upsert({ key: posterKey(c, cid), value: v });
    }
    await logAction(uid, "poster_chats", null);
    return NextResponse.json({ ok: true, chats: await posterChats(cid) });
  }

  if (b.action === "test") {
    const cat = String(b.cat || "");
    const chat = (await posterChats(cid))[cat];
    if (!chat) return NextResponse.json({ ok: false, error: "Чат не указан." });
    const r = await sendTgText(cid, chat, `✅ VETOKS: сюда будут приходить афиши (${POSTER_CAT_LABEL[cat] ?? cat}).`);
    return NextResponse.json({ ok: r.ok, error: r.error });
  }

  if (b.action === "resend") {
    const { data: it } = await supabaseAdmin
      .from("participant_posters")
      .select("id, user_id, name, city, age_category, image_url, height_cm, bad_cutout")
      .eq("id", String(b.id || ""))
      .maybeSingle();
    if (!it) return NextResponse.json({ ok: false, error: "Афіша не найдена." });
    const itCountry = await countryOfUser((it as any).user_id);
    if (!itCountry) return NextResponse.json({ ok: false, error: "Не определена страна участницы." });
    const chat = (await posterChats(itCountry))[(it as any).age_category];
    if (!chat) return NextResponse.json({ ok: false, error: "Для этой категории не указан чат." });
    const caption = [(it as any).name, POSTER_CAT_LABEL[(it as any).age_category], (it as any).city].filter(Boolean).join("\n");
    const r = await sendPosterToTg(itCountry, chat, (it as any).image_url, caption);
    if (r.ok) await supabaseAdmin.from("participant_posters").update({ sent_tg: true }).eq("id", (it as any).id);
    return NextResponse.json({ ok: r.ok, error: r.error });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
