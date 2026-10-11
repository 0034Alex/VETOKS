// Единая точка для валюты и цен по всему приложению.
//
// Как это работает: в CRM («Страны и регионы») указывается, какая страна
// сейчас включена (и её символ валюты), и отдельно — курс доллара к
// гривне. В CRM («Базовые цены», таб с ценами) каждая платная позиция
// задаётся один раз в долларах. Здесь мы один раз подтягиваем курс и
// список цен, переводим доллары в гривны и кешируем на время сессии —
// чтобы не дёргать базу на каждый рендер.

import { supabase } from "@/lib/supabaseClient";

let cachedSymbol: string | null = null;
let cachedRate: number | null = null;
let cachedPrices: Record<string, number> | null = null;

async function ensureRateAndSymbol() {
  if (cachedSymbol !== null && cachedRate !== null) return;

  const { data: country } = await supabase
    .from("countries")
    .select("currency_symbol")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  cachedSymbol = country?.currency_symbol ?? "₴";

  const { data: rateRow } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "usd_to_uah_rate")
    .maybeSingle();
  const parsed = Number(rateRow?.value);
  cachedRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 41;
}

/** Символ текущей валюты (₴ для Украины). */
export async function getCurrencySymbol(): Promise<string> {
  await ensureRateAndSymbol();
  return cachedSymbol as string;
}

/**
 * Все цены из CRM («Базовые цены»), уже переведённые из доллара в текущую
 * валюту по текущему курсу. Ключи — как в таблице app_prices (например
 * "paid_message", "boost", "collectible_card", "vote").
 */
export async function getAppPrices(): Promise<Record<string, number>> {
  await ensureRateAndSymbol();
  if (cachedPrices) return cachedPrices;

  const { data } = await supabase.from("app_prices").select("key, usd_price");
  const prices: Record<string, number> = {};
  (data ?? []).forEach((r: { key: string; usd_price: number }) => {
    prices[r.key] = Math.round(Number(r.usd_price) * (cachedRate as number));
  });
  cachedPrices = prices;
  return prices;
}

/** Сбросить кеш — например, сразу после сохранения новых цен в CRM. */
export function clearPricingCache() {
  cachedSymbol = null;
  cachedRate = null;
  cachedPrices = null;
}
