"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";
import { loadScoped, scopedKey } from "@/lib/scopedSettings";
import { COIN_KEYS, coinSettingsFrom, type CoinPack } from "@/lib/coins";

const f2 = (n: number) => String(Math.round(n * 100) / 100);

// CRM → «Монеты и Короны»: курсы, пакеты пополнения, бонус первой покупки, границы своей суммы.
export default function AdminCoinsPanel() {
  const [v, setV] = useState<Record<string, string>>({});
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const cur = crmCur;

  useEffect(() => {
    (async () => {
      const m = await loadScoped([...COIN_KEYS, "coins_per_usd"], getCrmCountry() || null);
      const s0 = coinSettingsFrom(m);
      // Если цена монеты в $ ещё не задана — подставляем ту, что сейчас фактически действует.
      if (!m.coin_usd) m.coin_usd = String(Math.round(s0.coinUsd * 1e6) / 1e6);
      setV(m);
      setPacks(s0.packs);
      setLoading(false);
    })();
  }, []);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  const s = coinSettingsFrom({ ...v, coin_packs: JSON.stringify(packs) });
  const rateNow = s.rate;

  async function save() {
    const cc = getCrmCountry() || null;
    const out: Record<string, string> = { ...v, coin_packs: JSON.stringify(packs.map((p) => ({ coins: p.coins, usd: p.usd, price: p.price, bonus: p.bonus }))) };
    // Курс $ тут не правится (он на Дашборде), поэтому его не записываем.
    await supabase
      .from("platform_settings")
      .upsert(COIN_KEYS.filter((k) => k !== "usd_to_uah_rate").map((k) => ({ key: scopedKey(k, cc), value: out[k] ?? "" })));
    // Цены в приложении (в монетах) больше не зависят от ежедневного курса: фиксируем множитель, если он ещё не задан.
    const fz = await loadScoped(["coins_per_usd", "usd_to_uah_rate"], cc);
    if (!fz.coins_per_usd && Number(fz.usd_to_uah_rate) > 0) {
      await supabase.from("platform_settings").upsert({ key: scopedKey("coins_per_usd", cc), value: String(fz.usd_to_uah_rate) });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const upd = (i: number, patch: Partial<CoinPack>) => setPacks((a) => a.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  if (loading) return <p className="text-muted">Загрузка...</p>;

  const inp = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  const Field = ({ k, label, hint, ph }: { k: string; label: string; hint?: string; ph?: string }) => (
    <div className="mb-3">
      <label className="block text-offwhite text-sm mb-1">{label}</label>
      <input type="number" step="any" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} className={`${inp} w-40`} />
      {hint && <p className="text-muted text-xs mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-lg flex flex-col gap-5">
      <p className="text-muted text-xs">Настройки действуют для выбранной страны в шапке CRM. Пусто — берутся значения по умолчанию (показаны серым).</p>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-3">Курсы</p>
        <Field k="coin_usd" label="Сколько $ стоит 1 монета" ph="0.0122" hint={`Сегодня курс $1 = ${f2(rateNow)} ${cur} (меняется на Дашборде). Значит 1 монета = ${Math.round(s.coinUsd * rateNow * 1000) / 1000} ${cur}, а за 1 ${cur} человек получает ${f2(s.coinsPerUnit)} монет. Цена монеты в $ не меняется, меняется только цена в ${cur}.`} />
        <Field k="crown_per_coin" label="Сколько Корон за 1 монету дохода участницы" ph={f2(1 / s.coinsPerUnit)} hint={`Сейчас: 1 монета = ${f2(s.crownPerCoin)} Короны (1 Корона = 1 ${cur} при выводе). Пусто — по курсу пополнения, участница получает ровно то, что стоила монета.`} />
        <Field k="coins_per_crown" label="Сколько монет за 1 Корону при обмене" ph={f2(s.coinsPerUnit)} hint={`Сейчас: 1 Корона = ${f2(s.coinsPerCrown)} монет. Обмен только в одну сторону (Короны → монеты).`} />
        <label className="flex items-center gap-2 text-offwhite text-sm">
          <input type="checkbox" checked={v.exchange_enabled !== "false"} onChange={(e) => set("exchange_enabled", e.target.checked ? "true" : "false")} />
          Обмен Корон на монеты включён
        </label>
        <p className="text-muted text-xs mt-3">
          Пример: подарок за 1000 монет при доле участнице 50% → {f2(1000 * 0.5 * s.crownPerCoin)} Корон на её балансе.
        </p>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-3">Пакеты монет</p>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-muted text-[11px] mb-1">
          <span>Монет</span>
          <span>Цена, $</span>
          <span>Бонус монет*</span>
          <span />
        </div>
        {packs.map((p, i) => (
          <div key={i} className="mb-2">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <input type="number" value={p.coins || ""} onChange={(e) => upd(i, { coins: Math.floor(Number(e.target.value)) })} className={`${inp} w-full min-w-0`} />
              <input type="number" step="any" value={p.usd || ""} onChange={(e) => upd(i, { usd: Number(e.target.value), price: Math.round(Number(e.target.value) * rateNow * 100) / 100 })} className={`${inp} w-full min-w-0`} />
              <input type="number" value={p.bonus || ""} onChange={(e) => upd(i, { bonus: Math.floor(Number(e.target.value)) })} placeholder="0" className={`${inp} w-full min-w-0`} />
              <button onClick={() => setPacks((a) => a.filter((_, j) => j !== i))} className="text-danger text-lg px-2" aria-label="Удалить">×</button>
            </div>
            {(p.usd ?? 0) > 0 && <p className="text-muted text-[11px] mt-0.5">сегодня = {f2((p.usd ?? 0) * rateNow)} {cur}</p>}
          </div>
        ))}
        <button onClick={() => setPacks((a) => [...a, { coins: 0, price: 0, usd: 0, bonus: 0 }])} className="text-gold text-sm underline">
          + Добавить пакет
        </button>
        <p className="text-muted text-xs mt-2">* Бонус даётся только на первую покупку в течение срока ниже. Пакеты с нулём в «монетах» или «цене» не сохраняются.</p>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-3">Бонус первой покупки и своя сумма</p>
        <Field k="first_bonus_days" label="Сколько дней действует бонус (от первого захода в кошелёк)" ph="3" hint="0 — бонуса нет" />
        <Field k="custom_bonus_percent" label="Бонус на свою сумму, % (только первая покупка)" ph="0" />
        <Field k="topup_min" label={`Своя сумма: от, ${cur}`} ph="20" />
        <Field k="topup_max" label={`Своя сумма: до, ${cur}`} ph="5000" />
      </div>

      <button onClick={save} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">
        {saved ? "Сохранено ✓" : "Сохранить"}
      </button>
    </div>
  );
}
