import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

// CRM → «Главная» → «Объявления»: яркий блок с датой окончания и выбором аудитории.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, starts_at, ends_at, audience, show_timer, is_active, country_id, all_regions, region_ids")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ ok: false, error: "need_sql" }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (b.action === "create") {
    const title = String(b.title ?? "").trim().slice(0, 120);
    const body = String(b.body ?? "").trim().slice(0, 400);
    const starts = new Date(b.starts_at ?? Date.now());
    const ends = new Date(b.ends_at ?? 0);
    if (!title) return NextResponse.json({ ok: false, error: "no_title" }, { status: 400 });
    if (isNaN(ends.getTime()) || ends <= starts) return NextResponse.json({ ok: false, error: "bad_dates" }, { status: 400 });
    const aud = (Array.isArray(b.audience) ? b.audience : []).filter((x: string) => ["teen", "main", "adult"].includes(x));
    const { error } = await supabaseAdmin.from("announcements").insert({
      title,
      body: body || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      audience: aud.length ? aud : ["teen", "main", "adult"],
      show_timer: b.show_timer === true,
      country_id: b.country_id ? String(b.country_id) : null,
      all_regions: b.all_regions !== false,
      region_ids: b.all_regions === false && Array.isArray(b.region_ids) ? b.region_ids.map(String).slice(0, 200) : [],
    });
    if (error) return NextResponse.json({ ok: false, error: "need_sql" }, { status: 500 });
    await logAction(uid, "announcement_create", null, { title });
    return NextResponse.json({ ok: true });
  }

  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  if (b.action === "toggle") {
    await supabaseAdmin.from("announcements").update({ is_active: b.active === true }).eq("id", id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "delete") {
    await supabaseAdmin.from("announcements").delete().eq("id", id);
    await logAction(uid, "announcement_delete", null, { id });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
