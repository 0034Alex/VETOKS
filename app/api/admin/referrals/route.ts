import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { REF_KEYS, getRefSettings } from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["finance_admin", "super_admin", "moderator"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));

  if (body.action === "get") {
    const s = await getRefSettings();
    const { data: all } = await supabaseAdmin.from("referrals").select("referrer_id, status, created_at").limit(5000);
    const rows = all ?? [];
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
    return NextResponse.json({
      ok: true,
      settings: s,
      totals: { invited: rows.length, qualified: rows.filter((r: any) => r.status === "qualified").length },
      top,
    });
  }

  if (body.action === "save") {
    const v = body.values ?? {};
    const rowsToSave = REF_KEYS.filter((k) => v[k] !== undefined).map((k) => ({ key: k, value: String(v[k]) }));
    if (rowsToSave.length) await supabaseAdmin.from("platform_settings").upsert(rowsToSave);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
