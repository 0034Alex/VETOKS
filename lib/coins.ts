// Монеты VETOKS (то, что видит зритель) и Короны (то, что получают участницы). Настройки — в CRM «Монеты и Короны».
export const COIN_KEYS = [
  "coins_per_unit",
  "crown_per_coin",
  "coins_per_crown",
  "coin_packs",
  "topup_min",
  "topup_max",
  "first_bonus_days",
  "custom_bonus_percent",
  "exchange_enabled",
];

export type CoinPack = { coins: number; price: number; bonus: number };

export type CoinSettings = {
  coinsPerUnit: number; // сколько монет за 1 денежную единицу страны (например, 2 монеты за 1 ₴)
  crownPerCoin: number; // сколько Корон получает участница за 1 монету дохода (до доли)
  coinsPerCrown: number; // сколько монет даём за 1 Корону при обмене
  packs: CoinPack[];
  topupMin: number;
  topupMax: number;
  bonusDays: number;
  customBonusPct: number;
  exchangeOn: boolean;
};

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && isFinite(n) && n >= 0 ? n : d;
};

export function parsePacks(raw: string | undefined): CoinPack[] {
  try {
    const a = JSON.parse(raw || "[]");
    if (Array.isArray(a)) {
      const out = a
        .map((x) => ({ coins: Math.floor(Number(x.coins)), price: Number(x.price), bonus: Math.max(0, Math.floor(Number(x.bonus) || 0)) }))
        .filter((x) => x.coins > 0 && x.price > 0);
      if (out.length) return out;
    }
  } catch {}
  return [
    { coins: 100, price: 50, bonus: 0 },
    { coins: 300, price: 150, bonus: 0 },
    { coins: 1000, price: 500, bonus: 0 },
  ];
}

export function coinSettingsFrom(m: Record<string, string>): CoinSettings {
  const cpu = num(m.coins_per_unit, 2) || 2;
  return {
    coinsPerUnit: cpu,
    crownPerCoin: num(m.crown_per_coin, 0) || 1 / cpu,
    coinsPerCrown: num(m.coins_per_crown, 0) || cpu,
    packs: parsePacks(m.coin_packs),
    topupMin: num(m.topup_min, 20),
    topupMax: num(m.topup_max, 5000),
    bonusDays: num(m.first_bonus_days, 3),
    customBonusPct: Math.min(500, num(m.custom_bonus_percent, 0)),
    exchangeOn: m.exchange_enabled !== "false",
  };
}
