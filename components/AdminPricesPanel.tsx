"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearPricingCache } from "@/lib/currency";

// CRM → «Цены»: всё платное в одном месте. У каждой позиции — цена в
// долларах и доля участницы в процентах.

type PriceRow = {
  key: string;
  label: string;
  usd: string;
  share: string;
  hasPrice: boolean; // false — у позиции нет цены, только доля (донаты)
  hasShare: boolean; // false — не привязано к участнице (пакеты голосов)
};

const PRICE_DEFAULTS: PriceRow[] = [
  { key: "vote", label: "1 голос (покупка пакетов голосов)", usd: "0.1", share: "0", hasPrice: true, hasShare: false },
  { key: "boost", label: "Буст «Продвинуть в топ» (+1000 голосов)", usd: "10", share: "50", hasPrice: true, hasShare: true },
  { key: "collectible_card", label: "Коллекционная карточка", usd: "3", share: "50", hasPrice: true, hasShare: true },
  { key: "weekly_goal", label: "Донаты на цель недели (сумма любая)", usd: "0", share: "50", hasPrice: false, hasShare: true },
];

type GiftRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  usd_price: string;
  share: string;
  is_active: boolean;
  chat_only?: boolean;
};

export default function AdminPricesPanel() {
  const [rate, setRate] = useState(41);
  const [rows, setRows] = useState<PriceRow[]>(PRICE_DEFAULTS);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [freeVotes, setFreeVotes] = useState("3");
  const [topupOn, setTopupOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState("");

  function flash(k: string) {
    setSavedKey(k);
    setTimeout(() => setSavedKey(""), 1500);
  }

  async function load() {
    setLoading(true);

    const { data: set } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["usd_to_uah_rate", "free_votes_total", "test_topup_enabled"]);
    const m: Record<string, string> = {};
    (set ?? []).forEach((r: { key: string; value: string }) => (m[r.key] = r.value));
    const r = Number(m.usd_to_uah_rate);
    setRate(Number.isFinite(r) && r > 0 ? r : 41);
    setFreeVotes(m.free_votes_total ?? "3");
    setTopupOn(m.test_topup_enabled !== "false");

    const { data: prices } = await supabase
      .from("app_prices")
      .select("key, label, usd_price, participant_share_percent");
    const byKey: Record<string, any> = {};
    (prices ?? []).forEach((p: any) => (byKey[p.key] = p));
    setRows(
      PRICE_DEFAULTS.map((d) => ({
        ...d,
        usd: String(byKey[d.key]?.usd_price ?? d.usd),
        share: String(byKey[d.key]?.participant_share_percent ?? d.share),
      }))
    );

    const { data: g } = await supabase
      .from("gift_catalog")
      .select("id, name, category, price, usd_price, participant_share_percent, is_active, chat_only")
      .order("price");
    setGifts(
      (g ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        category: x.category,
        price: Number(x.price),
        usd_price: x.usd_price == null ? "" : String(x.usd_price),
        share: String(x.participant_share_percent ?? 50),
        is_active: !!x.is_active,
        chat_only: !!x.chat_only,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function clampShare(v: string) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }

  async function saveRow(row: PriceRow) {
    await supabase.from("app_prices").upsert({
      key: row.key,
      label: row.label,
      usd_price: Number(row.usd) || 0,
      participant_share_percent: row.hasShare ? clampShare(row.share) : 0,
    });
    clearPricingCache();
    flash(row.key);
  }

  async function saveGift(g: GiftRow) {
    const usd = Number(g.usd_price);
    await supabase
      .from("gift_catalog")
      .update({
        usd_price: Number.isFinite(usd) && usd > 0 ? usd : null,
        participant_share_percent: clampShare(g.share),
        is_active: g.is_active,
      })
      .eq("id", g.id);
    flash(g.id);
  }

  async function saveSetting(key: string, value: string) {
    await supabase.from("platform_settings").upsert({ key, value });
    flash(key);
  }

  const uah = (usd: string) => Math.round((Number(usd) || 0) * rate);

  if (loading) return <p className="text-muted">Загрузка...</p>;

  const inputCls =
    "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-24";
  const btnCls =
    "bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm";

  return (
    <div className="max-w-xl">
      <p className="text-muted text-xs mb-4">
        Цена задаётся в долларах и показывается в гривнах по курсу {rate} ₴ за
        $1 (курс меняется на вкладке «Страны и регионы»). «Доля участницы» —
        сколько процентов от цены получает участница, которой подарили /
        купили. Остальное остаётся платформе.
      </p>

      <h3 className="text-offwhite font-semibold mb-2">Основное</h3>
      <div className="flex flex-col gap-3 mb-8">
        {rows.map((row, i) => (
          <div key={row.key} className="bg-bgSurface border border-gold/40 rounded-xl p-4">
            <p className="text-offwhite text-sm font-semibold mb-2">{row.label}</p>
            <div className="flex flex-wrap items-center gap-2">
              {row.hasPrice && (
                <>
                  <span className="text-muted text-sm">$</span>
                  <input
                    value={row.usd}
                    onChange={(e) => {
                      const n = [...rows];
                      n[i] = { ...row, usd: e.target.value };
                      setRows(n);
                    }}
                    className={inputCls}
                  />
                  <span className="text-muted text-xs">= {uah(row.usd)} ₴</span>
                </>
              )}
              {row.hasShare && (
                <>
                  <span className="text-muted text-xs ml-2">доля участницы</span>
                  <input
                    value={row.share}
                    onChange={(e) => {
                      const n = [...rows];
                      n[i] = { ...row, share: e.target.value };
                      setRows(n);
                    }}
                    className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-16"
                  />
                  <span className="text-muted text-sm">%</span>
                </>
              )}
              <button onClick={() => saveRow(row)} className={`${btnCls} ml-auto`}>
                {savedKey === row.key ? "✓" : "Сохранить"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Подарки</h3>
      <div className="flex flex-col gap-3 mb-8">
        {gifts.map((g, i) => (
          <div key={g.id} className="bg-bgSurface border border-muted rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-offwhite text-sm font-semibold">
                {g.name} <span className="text-muted text-xs">({g.chat_only ? "только в чате" : g.category})</span>
              </p>
              <label className="text-muted text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={g.is_active}
                  onChange={(e) => {
                    const n = [...gifts];
                    n[i] = { ...g, is_active: e.target.checked };
                    setGifts(n);
                  }}
                />
                в магазине
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted text-sm">$</span>
              <input
                value={g.usd_price}
                placeholder="—"
                onChange={(e) => {
                  const n = [...gifts];
                  n[i] = { ...g, usd_price: e.target.value };
                  setGifts(n);
                }}
                className={inputCls}
              />
              <span className="text-muted text-xs">
                = {g.usd_price ? uah(g.usd_price) : g.price} ₴
                {!g.usd_price && " (старая цена)"}
              </span>
              <span className="text-muted text-xs ml-2">доля участницы</span>
              <input
                value={g.share}
                onChange={(e) => {
                  const n = [...gifts];
                  n[i] = { ...g, share: e.target.value };
                  setGifts(n);
                }}
                className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-16"
              />
              <span className="text-muted text-sm">%</span>
              <button onClick={() => saveGift(g)} className={`${btnCls} ml-auto`}>
                {savedKey === g.id ? "✓" : "Сохранить"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Голоса и тест</h3>
      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-offwhite text-sm">Бесплатных голосов на аккаунт:</span>
          <input
            value={freeVotes}
            onChange={(e) => setFreeVotes(e.target.value)}
            className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-16"
          />
          <button
            onClick={() => saveSetting("free_votes_total", String(Math.max(0, Math.floor(Number(freeVotes) || 0))))}
            className={`${btnCls} ml-auto`}
          >
            {savedKey === "free_votes_total" ? "✓" : "Сохранить"}
          </button>
        </div>
        <label className="flex items-center gap-2 text-offwhite text-sm">
          <input
            type="checkbox"
            checked={topupOn}
            onChange={(e) => {
              setTopupOn(e.target.checked);
              saveSetting("test_topup_enabled", e.target.checked ? "true" : "false");
            }}
          />
          Кнопка «Пополнить (тест +1000)» в магазине. Перед запуском реальных
          платежей выключите.
        </label>
      </div>
    </div>
  );
}
