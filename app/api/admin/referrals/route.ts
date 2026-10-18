import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { REF_KEYS, getRefSettings } from "@/lib/referral";
import { regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["finance_admin", "super_admin", "moderator"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));

  if (body.action === "get") {
    const cid = body.countryId ? String(body.countryId) : null;
    const s = await getRefSettings(cid);
    const { data: all } = await supabaseAdmin.from("referrals").select("id, referrer_id, referred_id, status, created_at").order("created_at", { ascending: false }).limit(5000);
    let rows: any[] = all ?? [];
    if (cid) {
      // Только приглашения тех, кто из выбранной страны.
      const rids = await regionIdsOfCountry(cid);
      const refIds = Array.from(new Set(rows.map((r: any) => r.referrer_id)));
      const okIds = new Set<string>();
      for (let i = 0; i < refIds.length; i += 200) {
        const { data: us } = await supabaseAdmin.from("users").select("id").in("id", refIds.slice(i, i + 200)).in("region_id", rids);
        (us ?? []).forEach((u: any) => okIds.add(u.id));
      }
      rows = rows.filter((r: any) => okIds.has(r.referrer_id));
    }
    const by: Record<string, { total: number; ok: number; last24: number }> = {};
    const dayAgo = Date.now() - 86400000;
    rows.forEach((r: any) => {
      const g = (by[r.referrer_id] ??= { total: 0, ok: 0, last24: 0 });
      g.total++;
      if (r.status === "qualified") g.ok++;
      if (new Date(r.created_at).getTime() >= dayAgo) g.last24++;
    });
    const ids = Object.keys(by);
    const { data: users } = ids.length
      ? await supabaseAdmin.from("users").select("id, first_name, phone_verified").in("id", ids.slice(0, 300))
      : { data: [] as any[] };
    const um = new Map<string, any>(((users ?? []) as any[]).map((u: any) => [u.id, u]));
    const top = ids
      .map((id) => ({
        id,
        name: um.get(id)?.first_name ?? "—",
        verified: !!um.get(id)?.phone_verified,
        ...by[id],
        // подозрительно: много приглашений, но почти никто не подтвердил номер
        suspicious: by[id].total >= 5 && by[id].ok / by[id].total < 0.2,
      }))
      .sort((a, b) => b.ok - a.ok || b.total - a.total)
      .slice(0, 30);
    // Последние приглашения (для ручной проверки и отклонения накруток).
    const recentRows = rows.slice(0, 40);
    const rIds = Array.from(new Set(recentRows.flatMap((r: any) => [r.referrer_id, r.referred_id])));
    const { data: ru } = rIds.length
      ? await supabaseAdmin.from("users").select("id, first_name").in("id", rIds)
      : { data: [] as any[] };
    const rn = new Map<string, string>(((ru ?? []) as any[]).map((u: any) => [u.id, u.first_name]));
    const recent = recentRows.map((r: any) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      referrer: rn.get(r.referrer_id) ?? "—",
      invited: rn.get(r.referred_id) ?? "—",
    }));
    return NextResponse.json({
      ok: true,
      recent,
      settings: s,
      totals: { invited: rows.length, qualified: rows.filter((r: any) => r.status === "qualified").length },
      top,
    });
  }

  if (body.action === "reject") {
    // Отклонить можно только ожидающее приглашение: награда за него уже не будет выплачена.
    await supabaseAdmin.from("referrals").update({ status: "rejected" }).eq("id", String(body.id)).eq("status", "pending");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "save") {
    const v = body.values ?? {};
    const sfx = body.countryId ? ":" + String(body.countryId) : "";
    const rowsToSave = REF_KEYS.filter((k) => v[k] !== undefined).map((k) => ({ key: k + sfx, value: String(v[k]) }));
    if (rowsToSave.length) await supabaseAdmin.from("platform_settings").upsert(rowsToSave);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
