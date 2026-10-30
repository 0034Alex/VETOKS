"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { loadScoped, scopedKey } from "@/lib/scopedSettings";
import { clearPricingCache } from "@/lib/currency";
import { COIN_KEYS, coinSettingsFrom } from "@/lib/coins";

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
  art?: string | null;
  fx?: string;
  origName?: string;
};

export default function AdminPricesPanel({ hideGifts = false }: { hideGifts?: boolean }) {
  const cc = getCrmCountry() || null;
  const [sym, setSym] = useState("₴");
  const [rate, setRate] = useState(41);
  const [coinUsd, setCoinUsd] = useState(0.0122);
  const [fxNow, setFxNow] = useState(41);
  const [rateStr, setRateStr] = useState("41");
  const [rows, setRows] = useState<PriceRow[]>(PRICE_DEFAULTS);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [freeVotes, setFreeVotes] = useState("3");
  const [userShare, setUserShare] = useState("");
  const [topupOn, setTopupOn] = useState(true);
  const [fxSound, setFxSound] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState("");

  function flash(k: string) {
    setSavedKey(k);
    setTimeout(() => setSavedKey(""), 1500);
  }

  async function load() {
    setLoading(true);

    const m = await loadScoped(["coins_per_usd", "usd_to_uah_rate", "free_votes_total", "test_topup_enabled", "user_gift_share_percent"], getCrmCountry() || null);
    const r = Number(m.coins_per_usd) > 0 ? Number(m.coins_per_usd) : Number(m.usd_to_uah_rate);
    setRate(Number.isFinite(r) && r > 0 ? r : 41);
    setRateStr(String(Number.isFinite(r) && r > 0 ? r : 41));
    try {
      const cs = coinSettingsFrom(await loadScoped(COIN_KEYS, getCrmCountry() || null));
      setCoinUsd(cs.coinUsd);
      setFxNow(cs.rate);
    } catch {}
    setFreeVotes(m.free_votes_total ?? "3");
    setUserShare(m.user_gift_share_percent ?? "");
    setTopupOn(m.test_topup_enabled !== "false");

    if (cc) {
      const { data: c } = await supabase.from("countries").select("currency_symbol").eq("id", cc).maybeSingle();
      setSym(c?.currency_symbol ?? "₴");
    }
    const { data: prices } = await supabase
      .from("app_prices")
      .select("key, label, usd_price, participant_share_percent");
    const byKey: Record<string, any> = {};
    // Общие строки, поверх — строки выбранной страны ("<ключ>:<id страны>").
    (prices ?? []).forEach((p: any) => {
      if (!String(p.key).includes(":")) byKey[p.key] = p;
    });
    if (cc) {
      (prices ?? []).forEach((p: any) => {
        if (String(p.key).endsWith(":" + cc)) byKey[String(p.key).slice(0, -(cc.length + 1))] = p;
      });
    }
    setRows(
      PRICE_DEFAULTS.map((d) => ({
        ...d,
        usd: String(byKey[d.key]?.usd_price ?? d.usd),
        share: String(byKey[d.key]?.participant_share_percent ?? d.share),
      }))
    );

    const { data: g } = await supabase
      .from("gift_catalog")
      .select("*")
      .order("price");
    let ov = new Map<string, any>();
    if (cc) {
      const { data: o } = await supabase
        .from("gift_country_prices")
        .select("gift_id, usd_price, participant_share_percent, is_active")
        .eq("country_id", cc);
      ov = new Map(((o ?? []) as any[]).map((r) => [r.gift_id, r]));
    }
    setGifts(
      (g ?? []).map((x0: any) => {
        const o = ov.get(x0.id);
        const x = o
          ? { ...x0, usd_price: o.usd_price ?? x0.usd_price, participant_share_percent: o.participant_share_percent ?? x0.participant_share_percent, is_active: o.is_active ?? x0.is_active }
          : x0;
        return x;
      }).map((x: any) => ({
        id: x.id,
        name: x.name,
        category: x.category,
        price: Number(x.price),
        usd_price: x.usd_price == null ? "" : String(x.usd_price),
        share: String(x.participant_share_percent ?? 50),
        is_active: !!x.is_active,
        chat_only: !!x.chat_only,
        art: x.art ?? null,
        fx: x.fx ?? "",
        origName: x.name,
      }))
    );
    try {
      const { data: fs } = await supabase.from("platform_settings").select("value").eq("key", "gift_fx_sound").maybeSingle();
      setFxSound(!fs || String(fs.value) !== "false");
    } catch {}
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
      key: cc ? `${row.key}:${cc}` : row.key,
      label: row.label,
      usd_price: Number(row.usd) || 0,
      participant_share_percent: row.hasShare ? clampShare(row.share) : 0,
    });
    clearPricingCache();
    flash(row.key);
  }

  async function saveGift(g: GiftRow) {
    const usd = Number(g.usd_price);
    // Эффект подарка один для всех стран. Если колонки fx ещё нет — просто пропускаем.
    await supabase.from("gift_catalog").update({ fx: g.fx || null }).eq("id", g.id);
    if (cc) {
      // Для выбранной страны — своя цена/доля/«в магазине», общий каталог не трогаем.
      await supabase.from("gift_country_prices").upsert({
        gift_id: g.id,
        country_id: cc,
        usd_price: Number.isFinite(usd) && usd > 0 ? usd : null,
        participant_share_percent: clampShare(g.share),
        is_active: g.is_active,
      });
      await saveName(g);
      flash(g.id);
      return;
    }
    await supabase
      .from("gift_catalog")
      .update({
        usd_price: Number.isFinite(usd) && usd > 0 ? usd : null,
        participant_share_percent: clampShare(g.share),
        is_active: g.is_active,
      })
      .eq("id", g.id);
    await saveName(g);
    flash(g.id);
  }

  // Название подарка общее для всех стран. Картинка/значок остаются: старое имя
  // запоминается в колонке art (если её ещё нет — название просто сохранится).
  async function saveName(g: GiftRow) {
    const nm = g.name.trim();
    if (!nm || nm === g.origName) return;
    const upd: any = { name: nm };
    if (!g.art) upd.art = g.origName;
    let { error } = await supabase.from("gift_catalog").update(upd).eq("id", g.id);
    if (error && upd.art) ({ error } = await supabase.from("gift_catalog").update({ name: nm }).eq("id", g.id));
    if (!error) {
      await supabase.from("user_gifts").update({ gift_name: nm }).eq("gift_name", g.origName);
      setGifts((arr) => arr.map((x) => (x.id === g.id ? { ...x, origName: nm, art: x.art || g.origName } : x)));
    }
  }

  async function saveSetting(key: string, value: string) {
    await supabase.from("platform_settings").upsert({ key: scopedKey(key, getCrmCountry() || null), value });
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
      {!hideGifts && (
      <p className="text-muted text-xs mb-4">
        {cc
          ? "Вы правите цены ТОЛЬКО выбранной страны (другие страны не затрагиваются). Если для позиции ничего не сохранено, действует общая цена. "
          : "Это общие цены — они действуют в странах, где не заданы свои. Чтобы задать цены одной страны, выберите её вверху CRM. "}
        Цена задаётся в долларах и показывается в местной валюте по курсу {rate} {sym} за
        $1 (курс задаётся ниже, в самом верху этой страницы). «Доля участницы» —
        сколько процентов от цены получает участница, которой подарили /
        купили. Остальное остаётся платформе.
      </p>
      )}

      {!hideGifts && (
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <p className="text-offwhite text-sm font-semibold mb-1">Как считаются монеты</p>
        <p className="text-muted text-xs">Здесь цена в долларах переводится в монеты по числу: $1 = {rate} монет. Оно не меняется каждый день. Ежедневный курс {sym} к $ теперь вводится на Дашборде, он влияет только на цену пакетов монет в {sym}. Цены подарков удобнее править в «Цены и выплаты».</p>
      </div>
      )}

      <h3 className="text-offwhite font-semibold mb-2">Основное</h3>
      <div className="flex flex-col gap-3 mb-8">
        {rows.map((row, i) => (
          <div key={row.key} className="bg-bgSurface border border-gold/40 rounded-xl p-4">
            <p className="text-offwhite text-sm font-semibold mb-2">{row.label}</p>
            <div className="flex flex-wrap items-center gap-2">
              {row.hasPrice && (
                <>
                  <input
                    value={Math.round((Number(row.usd) || 0) * rate)}
                    inputMode="numeric"
                    onChange={(e) => {
                      const n = [...rows];
                      const coins = Math.max(0, Math.round(Number(e.target.value) || 0));
                      n[i] = { ...row, usd: String(Math.round((coins / rate) * 10000) / 10000) };
                      setRows(n);
                    }}
                    className={inputCls}
                  />
                  <span className="text-muted text-xs">монет = ${(Math.round((Number(row.usd) || 0) * rate) * coinUsd).toFixed(2)} ≈ {Math.round(Math.round((Number(row.usd) || 0) * rate) * coinUsd * fxNow * 100) / 100} {sym}</span>
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

      {!hideGifts && (
        <>
      <h3 className="text-offwhite font-semibold mb-1">Подарки</h3>
      <label className="flex items-center gap-2 text-offwhite text-sm mb-2">
        <input
          type="checkbox"
          checked={fxSound}
          onChange={async (e) => {
            setFxSound(e.target.checked);
            await supabase.from("platform_settings").upsert({ key: "gift_fx_sound", value: e.target.checked ? "true" : "false" });
            flash("gift_fx_sound");
          }}
        />
        Звук эффектов подарков (для всех пользователей)
        {savedKey === "gift_fx_sound" && <span className="text-success text-xs">✓</span>}
      </label>
      <p className="text-muted text-xs mb-2">«Эффект на экране»: по умолчанию — обычные подарки лёгкие, премиум и VIP на весь экран.</p>
      <p className="text-muted text-xs mb-2">Название можно менять прямо тут (оно одно для всех стран). Картинка подарка при переименовании остаётся.</p>
      <div className="flex flex-col gap-3 mb-8">
        {gifts.map((g, i) => (
          <div key={g.id} className="bg-bgSurface border border-muted rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <input
                  value={g.name}
                  onChange={(e) => {
                    const n = [...gifts];
                    n[i] = { ...g, name: e.target.value };
                    setGifts(n);
                  }}
                  className="bg-bgPrimary border border-muted rounded-lg px-2 py-1 text-sm font-semibold text-offwhite min-w-0 w-40"
                />
                <span className="text-muted text-xs flex-none">({g.chat_only ? "только в чате" : g.category})</span>
              </div>
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
                = {g.usd_price ? uah(g.usd_price) : g.price} {sym}
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
              <span className="text-muted text-xs ml-2 basis-full sm:basis-auto">эффект на экране</span>
              <select
                value={g.fx ?? ""}
                onChange={(e) => {
                  const n = [...gifts];
                  n[i] = { ...g, fx: e.target.value };
                  setGifts(n);
                }}
                className="bg-bgPrimary border border-muted rounded-lg px-2 py-2 text-sm"
              >
                <option value="">по умолчанию</option>
                <option value="off">без эффекта</option>
                <option value="mini">лёгкий</option>
                <option value="full">на весь экран</option>
              </select>
              <button onClick={() => saveGift(g)} className={`${btnCls} ml-auto`}>
                {savedKey === g.id ? "✓" : "Сохранить"}
              </button>
            </div>
          </div>
        ))}
      </div>
        </>
      )}

      <h3 className="text-offwhite font-semibold mb-2">Подарки обычным людям</h3>
      <div className="bg-bgSurface border border-muted rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-offwhite text-sm">Доля получателя (не участницы) от цены подарка:</span>
          <input
            value={userShare}
            onChange={(e) => setUserShare(e.target.value)}
            placeholder="как у подарка"
            className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-28"
          />
          <span className="text-muted text-sm">%</span>
          <button
            onClick={() => saveSetting("user_gift_share_percent", userShare.trim() === "" ? "" : String(Math.min(100, Math.max(0, Number(userShare) || 0))))}
            className={`${btnCls} ml-auto`}
          >
            {savedKey === "user_gift_share_percent" ? "✓" : "Сохранить"}
          </button>
        </div>
        <p className="text-muted text-xs mt-2">Пусто — берётся доля самого подарка (как у участниц). Для участниц эта цифра не действует.</p>
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
          Пробное пополнение (+1000) в подарках и голосах. Выключено — кнопки и
          надпись «Тестовый режим» не видны (для видео и скринов).
        </label>
      </div>
    </div>
  );
}
