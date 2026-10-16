import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const a = body.action;

  if (a === "list") {
    const region = body.regionId ? String(body.regionId) : null;
    const onlyReported = !!body.onlyReported;

    let reportedIds: string[] = [];
    const { data: reps } = await supabaseAdmin.from("clan_reports").select("message_id").limit(1000);
    const counts: Record<string, number> = {};
    (reps ?? []).forEach((r: any) => (counts[r.message_id] = (counts[r.message_id] ?? 0) + 1));
    reportedIds = Object.keys(counts);

    let q = supabaseAdmin
      .from("region_clan_messages")
      .select("id, body, created_at, is_hidden, user_id, region_id, users(first_name, username, clan_muted_until, is_banned), regions(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (region) q = q.eq("region_id", region);
    else if (body.countryId) q = q.in("region_id", await regionIdsOfCountry(String(body.countryId)));
    if (onlyReported) {
      if (reportedIds.length === 0) return NextResponse.json({ ok: true, rows: [] });
      q = q.in("id", reportedIds);
    }
    const { data } = await q;
    const rows = (data ?? []).map((m: any) => ({ ...m, reports: counts[m.id] ?? 0 }));
    return NextResponse.json({ ok: true, rows });
  }

  if (a === "hide") {
    const id = String(body.messageId ?? "");
    await supabaseAdmin.from("region_clan_messages").update({ is_hidden: !!body.hide }).eq("id", id);
    await logAction(uid, body.hide ? "clan_hide" : "clan_show", null, { message: id });
    return NextResponse.json({ ok: true });
  }

  if (a === "mute") {
    const userId = String(body.userId ?? "");
    const hours = Number(body.hours ?? 24);
    const until = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null;
    await supabaseAdmin.from("users").update({ clan_muted_until: until }).eq("id", userId);
    await logAction(uid, hours > 0 ? "clan_mute" : "clan_unmute", userId, { hours });
    return NextResponse.json({ ok: true });
  }

  if (a === "ban") {
    const userId = String(body.userId ?? "");
    await supabaseAdmin.from("users").update({ is_banned: true }).eq("id", userId);
    await logAction(uid, "ban", userId, { from: "clan" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
