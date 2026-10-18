import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { kyivDate, kyivDayStartUtc, addDays } from "@/lib/kyiv";

// Общие куски отчётов по рекламе (CRM и кабинет партнёра).
export function periodRange(body: any): { from: Date; to: Date } {
  const today = kyivDate();
  const tomorrow = kyivDayStartUtc(addDays(today, 1));
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (re.test(String(body.from ?? ""))) {
    const from = kyivDayStartUtc(String(body.from));
    const to = re.test(String(body.to ?? "")) ? kyivDayStartUtc(addDays(String(body.to), 1)) : tomorrow;
    return { from, to };
  }
  const p = String(body.period ?? "7d");
  if (p === "today") return { from: kyivDayStartUtc(today), to: tomorrow };
  if (p === "yesterday") return { from: kyivDayStartUtc(addDays(today, -1)), to: kyivDayStartUtc(today) };
  if (p === "30d") return { from: kyivDayStartUtc(addDays(today, -29)), to: tomorrow };
  if (p === "all") return { from: new Date("2000-01-01T00:00:00Z"), to: tomorrow };
  return { from: kyivDayStartUtc(addDays(today, -6)), to: tomorrow };
}

export const TYPE_LABEL: Record<string, string> = {
  banner: "Баннер",
  logo: "Логотип партнёра",
  magazine: "Реклама в журнале",
  popup: "Окно при входе",
  ticker: "Бегущая строка",
  directory: "Каталог партнёров",
};

// Название и картинка рекламы по типу и id.
export async function adInfo(rows: { target_type: string; target_id: string }[]) {
  const ids = (t: string) => rows.filter((r) => r.target_type === t).map((r) => r.target_id).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const [bn, lg, mg] = await Promise.all([
    ids("banner").length ? supabaseAdmin.from("promo_banners").select("id, image_url, link_url, placement").in("id", ids("banner")) : { data: [] as any[] },
    ids("logo").length ? supabaseAdmin.from("partner_logos").select("id, name, logo_url, link_url").in("id", ids("logo")) : { data: [] as any[] },
    ids("magazine").length ? supabaseAdmin.from("magazine_ads").select("id, image_url, description, button_link").in("id", ids("magazine")) : { data: [] as any[] },
  ]);
  const info = new Map<string, { name: string; image: string | null; link: string | null }>();
  (bn.data ?? []).forEach((b: any) => info.set("banner:" + b.id, { name: "Баннер · " + (b.placement ?? "main"), image: b.image_url, link: b.link_url }));
  (lg.data ?? []).forEach((l: any) => info.set("logo:" + l.id, { name: l.name || "Логотип", image: l.logo_url, link: l.link_url }));
  (mg.data ?? []).forEach((m: any) =>
    info.set("magazine:" + m.id, { name: "Журнал · " + String(m.description ?? "").slice(0, 40), image: m.image_url, link: m.button_link })
  );
  info.set("popup:entry", { name: "Окно при входе", image: null, link: null });
  info.set("ticker:ticker", { name: "Бегущая строка", image: null, link: null });
  return info;
}

export function metrics(r: any) {
  const impressions = Number(r.impressions ?? 0);
  const views = Number(r.views ?? 0);
  const clicks = Number(r.clicks ?? 0);
  return {
    impressions,
    views,
    uniqViewers: Number(r.uniq_viewers ?? 0),
    clicks,
    uniqClickers: Number(r.uniq_clickers ?? 0),
    swipes: Number(r.swipes ?? 0),
    skips: Number(r.skips ?? 0),
    closes: Number(r.closes ?? 0),
    avgDwellMs: Number(r.avg_dwell_ms ?? 0),
    ctr: views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0,
    viewability: impressions > 0 ? Math.round((views / impressions) * 1000) / 10 : 0,
  };
}

const DIMS = ["day", "hour", "region", "platform", "placement", "audience", "newness", "source"];

export async function breakdowns(from: Date, to: Date, type: string, id: string, country: string | null) {
  const out: Record<string, any[]> = {};
  await Promise.all(
    DIMS.map(async (d) => {
      const { data } = await supabaseAdmin.rpc("vt_ad_breakdown", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_type: type,
        p_id: id,
        p_dim: d,
        p_country: country,
      });
      out[d] = ((data as any[]) ?? []).map((x) => ({
        k: x.k,
        impressions: Number(x.impressions),
        views: Number(x.views),
        clicks: Number(x.clicks),
        swipes: Number(x.swipes),
      }));
    })
  );
  // Названия регионов вместо id.
  const rids = Array.from(new Set(out.region.map((x) => x.k).filter((k) => /^[0-9a-f-]{36}$/i.test(k))));
  if (rids.length) {
    const { data: rg } = await supabaseAdmin.from("regions").select("id, name").in("id", rids);
    const nm = new Map((rg ?? []).map((r: any) => [r.id, r.name]));
    out.region = out.region.map((x) => ({ ...x, k: nm.get(x.k) ?? x.k }));
  }
  return out;
}
