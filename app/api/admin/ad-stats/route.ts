import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { adInfo, breakdowns, metrics, periodRange, TYPE_LABEL } from "@/lib/adStatsServer";

export const dynamic = "force-dynamic";

// CRM → «Статистика рекламы»: список, подробности по одной рекламе, привязка к партнёру.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const country = body.countryId ? String(body.countryId) : null;
  const { from, to } = periodRange(body);

  if (body.action === "set_owner") {
    const type = String(body.type || "");
    const id = String(body.id || "");
    if (!type || !id) return NextResponse.json({ ok: false }, { status: 400 });
    await supabaseAdmin.from("ad_owners").upsert({
      target_type: type,
      target_id: id,
      sponsor_user_id: body.sponsorUserId ? String(body.sponsorUserId) : null,
      label: body.label ? String(body.label).slice(0, 80) : null,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "detail") {
    const type = String(body.type || "");
    const id = String(body.id || "");
    const b = await breakdowns(from, to, type, id, country);
    return NextResponse.json({ ok: true, breakdowns: b });
  }

  const { data: stats } = await supabaseAdmin.rpc("vt_ad_report", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_country: country,
  });
  const rows: any[] = (stats as any[]) ?? [];
  const info = await adInfo(rows);
  const { data: owners } = await supabaseAdmin.from("ad_owners").select("target_type, target_id, sponsor_user_id, label");
  const om = new Map((owners ?? []).map((o: any) => [o.target_type + ":" + o.target_id, o]));

  const { data: sp } = await supabaseAdmin.from("sponsors").select("name, user_id").not("user_id", "is", null);
  const sponsors = (sp ?? []).map((s: any) => ({ userId: s.user_id, name: s.name }));
  const sn = new Map(sponsors.map((s) => [s.userId, s.name]));

  const items = rows
    .map((r) => {
      const k = r.target_type + ":" + r.target_id;
      const inf = info.get(k);
      const o: any = om.get(k);
      return {
        type: r.target_type,
        typeLabel: TYPE_LABEL[r.target_type] ?? r.target_type,
        id: r.target_id,
        name: o?.label || inf?.name || TYPE_LABEL[r.target_type] || r.target_type,
        image: inf?.image ?? null,
        link: inf?.link ?? null,
        sponsorUserId: o?.sponsor_user_id ?? null,
        sponsorName: o?.sponsor_user_id ? sn.get(o.sponsor_user_id) ?? "—" : null,
        ...metrics(r),
      };
    })
    .sort((a, b) => b.views - a.views || b.impressions - a.impressions);
  return NextResponse.json({ ok: true, items, sponsors });
}
