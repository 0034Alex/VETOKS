// Единая точка для валюты и цен по всему приложению.
//
// Как это работает: в CRM («Страны и регионы») указывается, какая страна
// сейчас включена (и её символ валюты), и отдельно — курс доллара к
// гривне. В CRM («Базовые цены», таб с ценами) каждая платная позиция
// задаётся один раз в долларах. Здесь мы один раз подтягиваем курс и
// список цен, переводим доллары в гривны и кешируем на время сессии —
// чтобы не дёргать базу на каждый рендер.

import { supabase } from "@/lib/supabaseClient";
import { getMyCountry } from "@/lib/myCountry";
import { loadScoped } from "@/lib/scopedSettings";

let cachedSymbol: string | null = null;
let cachedRate: number | null = null;
let cachedPrices: Record<string, number> | null = null;
let cachedFor: string | null | undefined = undefined;

// Валюта и курс — по стране пользователя (у каждой страны свои).
async function ensureRateAndSymbol() {
  const mc = await getMyCountry();
  if (cachedSymbol !== null && cachedRate !== null && cachedFor === mc.countryId) return;
  cachedPrices = null;
  cachedFor = mc.countryId;

  let sym: string | null = null;
  if (mc.countryId) {
    const { data: c } = await supabase.from("countries").select("currency_symbol").eq("id", mc.countryId).maybeSingle();
    sym = c?.currency_symbol ?? null;
  }
  if (!sym) {
    const { data: country } = await supabase
      .from("countries")
      .select("currency_symbol")
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    sym = country?.currency_symbol ?? "₴";
  }
  cachedSymbol = sym;

  const m = await loadScoped(["usd_to_uah_rate"], mc.countryId);
  const parsed = Number(m.usd_to_uah_rate);
  cachedRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 41;
}

/** Символ текущей валюты (₴ для Украины). */
// Внутри приложения всё считается в монетах VETOKS (знак — золотая монета с короной, см. globals.css).
export const COIN = "\uE000";
export async function getCurrencySymbol(): Promise<string> {
  return COIN;
}

/** Настоящая валюта страны (₴) — для оплаты рекламы и пополнения. */
export async function getRealCurrencySymbol(): Promise<string> {
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
  const own = cachedFor ? ":" + cachedFor : null;
  // Сначала общие цены, поверх — цены своей страны ("<ключ>:<id страны>").
  (data ?? []).forEach((r: { key: string; usd_price: number }) => {
    if (!String(r.key).includes(":")) prices[r.key] = Math.round(Number(r.usd_price) * (cachedRate as number));
  });
  if (own) {
    (data ?? []).forEach((r: { key: string; usd_price: number }) => {
      if (String(r.key).endsWith(own)) prices[String(r.key).slice(0, -own.length)] = Math.round(Number(r.usd_price) * (cachedRate as number));
    });
  }
  cachedPrices = prices;
  return prices;
}

/** Сбросить кеш — например, сразу после сохранения новых цен в CRM. */
export function clearPricingCache() {
  cachedFor = undefined;
  cachedSymbol = null;
  cachedRate = null;
  cachedPrices = null;
}

/** Курс доллара к местной валюте (для пересчёта цен подарков из CRM). */
export async function getUsdRate(): Promise<number> {
  await ensureRateAndSymbol();
  return cachedRate as number;
}

/** Подарки с ценой/долей/«в магазине» своей страны (если в CRM заданы свои). */
export async function applyGiftOverrides<T extends { id: string; usd_price?: any; participant_share_percent?: any; is_active?: any }>(
  gifts: T[]
): Promise<T[]> {
  const mc = await getMyCountry();
  if (!mc.countryId || gifts.length === 0) return gifts;
  const { data } = await supabase
    .from("gift_country_prices")
    .select("gift_id, usd_price, participant_share_percent, is_active")
    .eq("country_id", mc.countryId);
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
