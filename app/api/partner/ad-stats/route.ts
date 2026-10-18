import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { adInfo, breakdowns, metrics, periodRange, TYPE_LABEL } from "@/lib/adStatsServer";

export const dynamic = "force-dynamic";

// Кабинет партнёра: цифры только по его собственной рекламе (привязка делается в CRM).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const { from, to } = periodRange(body);

  const { data: mine } = await supabaseAdmin.from("ad_owners").select("target_type, target_id, label").eq("sponsor_user_id", uid);
  const own = new Map<string, any>((mine ?? []).map((o: any) => [o.target_type + ":" + o.target_id, o]));
  if (own.size === 0) return NextResponse.json({ ok: true, items: [] });

  if (body.action === "detail") {
    const type = String(body.type || "");
    const id = String(body.id || "");
    if (!own.has(type + ":" + id)) return NextResponse.json({ ok: false }, { status: 403 });
    return NextResponse.json({ ok: true, breakdowns: await breakdowns(from, to, type, id, null) });
  }

  const { data: stats } = await supabaseAdmin.rpc("vt_ad_report", { p_from: from.toISOString(), p_to: to.toISOString(), p_country: null });
  const rows = ((stats as any[]) ?? []).filter((r) => own.has(r.target_type + ":" + r.target_id));
  const info = await adInfo(Array.from(own.keys()).map((k) => ({ target_type: k.split(":")[0], target_id: k.slice(k.indexOf(":") + 1) })));
  const seen = new Set(rows.map((r) => r.target_type + ":" + r.target_id));
  // Реклама без событий за период тоже в списке (с нулями).
  Array.from(own.keys()).forEach((k) => {
    if (!seen.has(k)) rows.push({ target_type: k.split(":")[0], target_id: k.slice(k.indexOf(":") + 1) });
  });
  const items = rows
    .map((r) => {
      const k = r.target_type + ":" + r.target_id;
      const inf = info.get(k);
      return {
        type: r.target_type,
        typeLabel: TYPE_LABEL[r.target_type] ?? r.target_type,
        id: r.target_id,
        name: (own.get(k) as any)?.label || inf?.name || TYPE_LABEL[r.target_type] || r.target_type,
        image: inf?.image ?? null,
        ...metrics(r),
      };
    })
    .sort((a, b) => b.views - a.views);
  return NextResponse.json({ ok: true, items });
}
