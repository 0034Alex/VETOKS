import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

// CRM → «Номинации и победители»: вручную вносим, кто победил в какой номинации какого шоу и сезона.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const { data } = await supabaseAdmin
      .from("show_awards")
      .select("id, show_key, season, nomination, participant_id, created_at, participants(display_name, photo_url)")
      .eq("show_key", String(b.showKey || ""))
      .order("created_at", { ascending: true });
    const items = ((data as any[]) ?? []).map((r) => {
      const p = Array.isArray(r.participants) ? r.participants[0] : r.participants;
      return { id: r.id, season: r.season, nomination: r.nomination, participantId: r.participant_id, name: p?.display_name ?? "", photo: p?.photo_url ?? null };
    });
    return NextResponse.json({ ok: true, items });
  }

  if (b.action === "find") {
    const q = String(b.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 40);
    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });
    const { data } = await supabaseAdmin.from("participants").select("id, display_name, photo_url").ilike("display_name", `%${q}%`).limit(8);
    return NextResponse.json({ ok: true, items: ((data as any[]) ?? []).map((p) => ({ id: p.id, name: p.display_name, photo: p.photo_url })) });
  }

  if (b.action === "add") {
    const nomination = String(b.nomination ?? "").trim().slice(0, 80);
    const season = String(b.season ?? "Сезон 1").trim().slice(0, 40) || "Сезон 1";
    const showKey = String(b.showKey ?? "").trim();
    if (!nomination || !showKey || !b.participantId) return NextResponse.json({ ok: false, message: "Заполните шоу, номинацию и победительницу." });
    const { error } = await supabaseAdmin.from("show_awards").insert({ show_key: showKey, season, nomination, participant_id: String(b.participantId) });
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "award_add", String(b.participantId), { showKey, season, nomination });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "remove") {
    await supabaseAdmin.from("show_awards").delete().eq("id", String(b.id || ""));
    await logAction(uid, "award_remove", String(b.id || ""), {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
