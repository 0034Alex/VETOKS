import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Цены на сервере. Источник правды — CRM: цена в долларах × курс.
// Клиент цену не присылает — мы берём её сами, поэтому подменить нельзя.

// Курс доллара у каждой страны свой (ключ usd_to_uah_rate:<id страны>);
// если для страны не задан — берётся общий.
export async function getUsdRate(countryId?: string | null): Promise<number> {
  // Сколько монет стоит $1 в ценах приложения. Это число НЕ меняется с ежедневным курсом:
  // ключ coins_per_usd; если его ещё нет — старый курс usd_to_uah_rate.
  const keys = ["coins_per_usd", "usd_to_uah_rate"];
  if (countryId) keys.push(`coins_per_usd:${countryId}`, `usd_to_uah_rate:${countryId}`);
  const { data } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", keys);
  const m: Record<string, string> = {};
  (data ?? []).forEach((r: any) => (m[r.key] = r.value));
  const pick = (k: string) => {
    const own = countryId ? Number(m[`${k}:${countryId}`]) : NaN;
    if (Number.isFinite(own) && own > 0) return own;
    const g = Number(m[k]);
    return Number.isFinite(g) && g > 0 ? g : NaN;
  };
  const n = pick("coins_per_usd");
  if (Number.isFinite(n)) return n;
  const legacy = pick("usd_to_uah_rate");
  return Number.isFinite(legacy) ? legacy : 41;
}

// Цена и доля у каждой страны могут быть свои: строка "<ключ>:<id страны>",
// а если для страны не задано — общая строка "<ключ>".
async function priceRow(key: string, countryId?: string | null) {
  const keys = [key];
  if (countryId) keys.push(`${key}:${countryId}`);
  const { data } = await supabaseAdmin
    .from("app_prices")
    .select("key, usd_price, participant_share_percent")
    .in("key", keys);
  const rows = (data ?? []) as any[];
  return (countryId ? rows.find((r) => r.key === `${key}:${countryId}`) : null) ?? rows.find((r) => r.key === key) ?? null;
}

export async function getAppPrice(
  key: string,
  rate?: number,
  countryId?: string | null
): Promise<{ price: number; share: number } | null> {
  const data = await priceRow(key, countryId);
  if (!data) return null;
  const r = rate ?? (await getUsdRate(countryId));
  const share = Number(data.participant_share_percent);
  return {
    price: Math.round(Number(data.usd_price) * r),
    share: Number.isFinite(share) ? share : 50,
  };
}

// Доля участницы для позиций без цены (например, донат на цель недели).
export async function getShare(key: string, countryId?: string | null): Promise<number> {
  const data = await priceRow(key, countryId);
  const n = Number(data?.participant_share_percent);
  return Number.isFinite(n) ? n : 50;
}

// Подарки: у страны могут быть свои цена, доля и «в магазине» (таблица gift_country_prices).
export async function applyGiftOverrides<T extends { id: string; usd_price?: any; participant_share_percent?: any; is_active?: any }>(
  gifts: T[],
  countryId?: string | null
): Promise<T[]> {
  if (!countryId || gifts.length === 0) return gifts;
  const { data } = await supabaseAdmin
    .from("gift_country_prices")
    .select("gift_id, usd_price, participant_share_percent, is_active")
    .eq("country_id", countryId);
  const m = new Map<string, any>(((data ?? []) as any[]).map((r) => [r.gift_id, r]));
  return gifts.map((g) => {
    const o = m.get(g.id);
    if (!o) return g;
    return {
      ...g,
      usd_price: o.usd_price ?? g.usd_price,
      participant_share_percent: o.participant_share_percent ?? g.participant_share_percent,
      is_active: o.is_active ?? g.is_active,
    };
  });
}

export function giftUahPrice(
  g: { price: number; usd_price?: number | null },
  rate: number
): number {
  const usd = Number(g.usd_price);
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * rate) : Number(g.price);
}
