import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { regionIdsOfCountry } from "@/lib/countryServer";
import { logAction, requireStaff } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

// CRM → «Жалобы на переписки»: список с последними сообщениями, «закрыть», «заблокировать автора».
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "close" || b.action === "ban") {
    const id = String(b.id || "");
    const { data: rep } = await supabaseAdmin.from("dm_reports").select("id, reported_id").eq("id", id).maybeSingle();
    if (!rep) return NextResponse.json({ ok: false }, { status: 404 });
    if (b.action === "ban") {
      await supabaseAdmin.from("users").update({ is_banned: true }).eq("id", rep.reported_id);
      await logAction(uid, "ban", rep.reported_id as string, { via: "dm_report" });
    }
    await supabaseAdmin.from("dm_reports").update({ status: "closed" }).eq("reported_id", rep.reported_id).eq("status", "open");
    await logAction(uid, "dm_report_close", rep.reported_id as string, {});
    return NextResponse.json({ ok: true });
  }

  const { data: reps } = await supabaseAdmin
    .from("dm_reports")
    .select("id, reporter_id, reported_id, thread_id, reason, details, created_at, snapshot")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(300);
  // Только жалобы на людей из выбранной в CRM страны.
  let repsList: any[] = reps ?? [];
  if (b.countryId) {
    const rids = await regionIdsOfCountry(String(b.countryId));
    const ids0 = Array.from(new Set(repsList.map((r) => r.reported_id)));
    const ok = new Set<string>();
    for (let i = 0; i < ids0.length; i += 200) {
      const { data: us } = await supabaseAdmin.from("users").select("id").in("id", ids0.slice(i, i + 200)).in("region_id", rids);
      (us ?? []).forEach((u: any) => ok.add(u.id));
    }
    repsList = repsList.filter((r) => ok.has(r.reported_id));
  }
  repsList = repsList.slice(0, 100);
  const items: any[] = [];
  for (const r of repsList) {
    const { data: msgs } = await supabaseAdmin
      .from("dm_messages")
      .select("sender_id, body, kind, created_at")
      .eq("thread_id", r.thread_id)
      .order("created_at", { ascending: false })
      .limit(15);
    const live = (msgs ?? []).reverse();
    const snap = Array.isArray((r as any).snapshot) ? (r as any).snapshot : [];
    items.push({ ...r, messages: live.length ? live : snap });
  }
  const ids = Array.from(new Set(items.flatMap((i) => [i.reporter_id, i.reported_id])));
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await supabaseAdmin.from("users").select("id, first_name").in("id", ids);
    (us ?? []).forEach((u: any) => (names[u.id] = u.first_name || "Без имени"));
  }
  return NextResponse.json({ ok: true, items, names });
}
