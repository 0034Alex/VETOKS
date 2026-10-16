import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Цены на сервере. Источник правды — CRM: цена в долларах × курс.
// Клиент цену не присылает — мы берём её сами, поэтому подменить нельзя.

// Курс доллара у каждой страны свой (ключ usd_to_uah_rate:<id страны>);
// если для страны не задан — берётся общий.
export async function getUsdRate(countryId?: string | null): Promise<number> {
  const keys = ["usd_to_uah_rate"];
  if (countryId) keys.push(`usd_to_uah_rate:${countryId}`);
  const { data } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", keys);
  const m: Record<string, string> = {};
  (data ?? []).forEach((r: any) => (m[r.key] = r.value));
  const own = countryId ? Number(m[`usd_to_uah_rate:${countryId}`]) : NaN;
  const n = Number.isFinite(own) && own > 0 ? own : Number(m.usd_to_uah_rate);
  return Number.isFinite(n) && n > 0 ? n : 41;
}

export async function getAppPrice(
  key: string,
  rate?: number
): Promise<{ price: number; share: number } | null> {
  const { data } = await supabaseAdmin
    .from("app_prices")
    .select("usd_price, participant_share_percent")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  const r = rate ?? (await getUsdRate());
  const share = Number(data.participant_share_percent);
  return {
    price: Math.round(Number(data.usd_price) * r),
    share: Number.isFinite(share) ? share : 50,
  };
}

// Доля участницы для позиций без цены (например, донат на цель недели).
export async function getShare(key: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_prices")
    .select("participant_share_percent")
    .eq("key", key)
    .maybeSingle();
  const n = Number(data?.participant_share_percent);
  return Number.isFinite(n) ? n : 50;
}

export function giftUahPrice(
  g: { price: number; usd_price?: number | null },
  rate: number
): number {
  const usd = Number(g.usd_price);
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * rate) : Number(g.price);
}
