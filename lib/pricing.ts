import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Цены на сервере. Источник правды — CRM: цена в долларах × курс.
// Клиент цену не присылает — мы берём её сами, поэтому подменить нельзя.

export async function getUsdRate(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "usd_to_uah_rate")
    .maybeSingle();
  const n = Number(data?.value);
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
