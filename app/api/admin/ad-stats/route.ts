import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { kyivDate, kyivDayStartUtc, addDays } from "@/lib/kyiv";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const period = String(body.period ?? "7d");
  const today = kyivDate();
  const from =
    period === "today" ? kyivDayStartUtc(today)
    : period === "30d" ? kyivDayStartUtc(addDays(today, -29))
    : period === "all" ? new Date("2000-01-01T00:00:00Z")
    : kyivDayStartUtc(addDays(today, -6));

  const { data: stats } = await supabaseAdmin.rpc("vt_ad_stats", { p_from: from.toISOString() });
  const rows: any[] = (stats as any[]) ?? [];

  const bannerIds = rows.filter((r) => r.target_type === "banner").map((r) => r.target_id);
  const logoIds = rows.filter((r) => r.target_type === "logo").map((r) => r.target_id);
  const { data: banners } = bannerIds.length
    ? await supabaseAdmin.from("promo_banners").select("id, image_url, link_url").in("id", bannerIds)
    : { data: [] as any[] };
  const { data: logos } = logoIds.length
    ? await supabaseAdmin.from("partner_logos").select("id, name, logo_url").in("id", logoIds)
    : { data: [] as any[] };
  const bm = new Map((banners ?? []).map((b: any) => [b.id, b]));
  const lm = new Map((logos ?? []).map((l: any) => [l.id, l]));

  const items = rows
    .map((r) => {
      const info: any = r.target_type === "banner" ? bm.get(r.target_id) : lm.get(r.target_id);
      return {
        type: r.target_type,
        id: r.target_id,
        views: Number(r.views),
        clicks: Number(r.clicks),
        name: info?.name ?? (r.target_type === "banner" ? "Баннер" : "Логотип"),
        image: info?.image_url ?? info?.logo_url ?? null,
        link: info?.link_url ?? null,
      };
    })
    .sort((a, b) => b.views - a.views);
  return NextResponse.json({ ok: true, items });
}
