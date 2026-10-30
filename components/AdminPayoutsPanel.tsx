"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { loadScoped, scopedKey } from "@/lib/scopedSettings";
import { clearPricingCache } from "@/lib/currency";
import { COIN_KEYS, coinSettingsFrom } from "@/lib/coins";
import { ACT_DEFAULT, ACT_KEY, ACT_KINDS, parseAct, type ActKind, type ActRules } from "@/lib/activityShared";

const AMB_SHARE_KEY = "ambassador_share";
import { apiPost } from "@/lib/authClient";
import AdminPricesPanel from "@/components/AdminPricesPanel";

// CRM → Деньги → «Цены и выплаты»: цена подарков в монетах (доллары считаются сами)
// и выплаты участницам: амбассадоры и повышение за активность.

type GO = { coins: number; share: string; is_active: boolean; fx: string; name: string };
type G = GO & { id: string; category: string; chat_only: boolean; art: string | null; o: GO };
const TABS: { k: string; label: string }[] = [
  { k: "light", label: "Лёгкие" },
  { k: "premium", label: "Премиум" },
  { k: "vip", label: "VIP" },
  { k: "chat", label: "Чатовые" },
];

export default function AdminPayoutsPanel() {
  const cc = getCrmCountry() || null;
  const [rate, setRate] = useState(41); // монет за $1 (множитель цен, не меняется ежедневно)
  const [coinUsd, setCoinUsd] = useState(0.0122); // $ за 1 монету
  const [fx, setFx] = useState(41); // сегодняшний курс $ к валюте страны
  const [sym, setSym] = useState("₴");
  const [gifts, setGifts] = useState<G[]>([]);
  const [tab, setTab] = useState("light");
  const [pct, setPct] = useState("10");
  const [amb, setAmb] = useState("");
  const [act, setAct] = useState<ActRules>(ACT_DEFAULT);
  const [fxSound, setFxSound] = useState(true);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const m = await loadScoped([...COIN_KEYS, "coins_per_usd"], cc);
    const cs = coinSettingsFrom(m);
    const kk = Number(m.coins_per_usd) > 0 ? Number(m.coins_per_usd) : cs.rate;
    setRate(kk);
    setCoinUsd(cs.coinUsd);
    setFx(cs.rate);
    if (cc) {
      const { data: c } = await supabase.from("countries").select("currency_symbol").eq("id", cc).maybeSingle();
      setSym(c?.currency_symbol ?? "₴");
    }
    const { data: g } = await supabase.from("gift_catalog").select("*").order("price");
    let ov = new Map<string, any>();
    if (cc) {
      const { data: o } = await supabase.from("gift_country_prices").select("gift_id, usd_price, participant_share_percent, is_active").eq("country_id", cc);
      ov = new Map(((o ?? []) as any[]).map((x) => [x.gift_id, x]));
    }
    setGifts(
      ((g ?? []) as any[]).map((x0) => {
        const o = ov.get(x0.id);
        const usd = o?.usd_price ?? x0.usd_price;
        const coins = usd != null && Number(usd) > 0 ? Math.round(Number(usd) * kk) : Number(x0.price) || 0;
        const base: GO = {
          coins,
          share: String(o?.participant_share_percent ?? x0.participant_share_percent ?? 50),
          is_active: !!(o?.is_active ?? x0.is_active),
          fx: x0.fx ?? "",
          name: x0.name,
        };
        return { ...base, id: x0.id, category: x0.category, chat_only: !!x0.chat_only, art: x0.art ?? null, o: base } as G;
      })
    );
    const { data: ps } = await supabase.from("platform_settings").select("key, value").in("key", [AMB_SHARE_KEY, ACT_KEY, "gift_fx_sound"]);
    const by: Record<string, string> = {};
    (ps ?? []).forEach((x: any) => (by[x.key] = x.value));
    setAmb(by[AMB_SHARE_KEY] ?? "");
    setAct(by[ACT_KEY] ? parseAct(by[ACT_KEY]) : ACT_DEFAULT);
    setFxSound(by.gift_fx_sound !== "false");
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const inTab = (g: G) => (tab === "chat" ? g.chat_only : !g.chat_only && g.category === tab);
  const list = useMemo(() => gifts.filter(inTab), [gifts, tab]);
  const isCh = (g: G) => g.coins !== g.o.coins || g.share !== g.o.share || g.is_active !== g.o.is_active || g.fx !== g.o.fx || g.name.trim() !== g.o.name;
  const changed = gifts.filter(isCh);

  const patch = (id: string, p: Partial<GO>) => setGifts((a) => a.map((g) => (g.id === id ? { ...g, ...p } : g)));
  function bulk(sign: 1 | -1) {
    const p = (Number(pct) || 0) / 100;
    setGifts((a) => a.map((g) => (inTab(g) ? { ...g, coins: Math.max(1, Math.round(g.coins * (1 + sign * p))) } : g)));
  }

  // Название общее для всех стран. Рисунок остаётся: старое имя запоминается в колонке art.
  async function saveName(g: G) {
    const nm = g.name.trim();
    if (!nm || nm === g.o.name) return true;
    const upd: any = { name: nm };
    if (!g.art) upd.art = g.o.name;
    let { error } = await supabase.from("gift_catalog").update(upd).eq("id", g.id);
    if (error && upd.art) ({ error } = await supabase.from("gift_catalog").update({ name: nm }).eq("id", g.id));
    if (!error) await supabase.from("user_gifts").update({ gift_name: nm }).eq("gift_name", g.o.name);
    return !error;
  }

  async function saveAll() {
    setMsg("Сохраняю…");
    let fail = 0;
    for (const g of changed) {
      const usd = Math.round((g.coins / rate) * 10000) / 10000;
      const share = Math.min(100, Math.max(0, Number(g.share) || 0));
      const q = cc
        ? supabase.from("gift_country_prices").upsert({ gift_id: g.id, country_id: cc, usd_price: usd > 0 ? usd : null, participant_share_percent: share, is_active: g.is_active })
        : supabase.from("gift_catalog").update({ usd_price: usd > 0 ? usd : null, participant_share_percent: share, is_active: g.is_active }).eq("id", g.id);
      const { error } = await q;
      if (error) fail++;
      if (g.fx !== g.o.fx) await supabase.from("gift_catalog").update({ fx: g.fx || null }).eq("id", g.id);
      if (!(await saveName(g))) fail++;
    }
    clearPricingCache();
    if (!fail) setGifts((a) => a.map((g) => ({ ...g, name: g.name.trim(), o: { coins: g.coins, share: g.share, is_active: g.is_active, fx: g.fx, name: g.name.trim() } })));
    setMsg(fail ? `Не сохранилось: ${fail}` : "Сохранено ✓");
    setTimeout(() => setMsg(""), 2500);
  }

  async function savePayouts() {
    const r: any = await apiPost("/api/admin/badges", { action: "amb_share", value: Number(amb) || 0 });
    if (!r?.ok) {
      setMsg(r?.error === "owner_only" ? "Процент амбассадора может менять только владелец" : "Не удалось сохранить процент амбассадора");
      setTimeout(() => setMsg(""), 3500);
      return;
    }
    await supabase.from("platform_settings").upsert({ key: ACT_KEY, value: JSON.stringify({ ...act, amb: false }) });
    setMsg("Выплаты сохранены ✓");
    setTimeout(() => setMsg(""), 2500);
  }

  const cls = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm";
  const btn = "bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm";
  const ghost = "border border-gold text-gold px-3 py-1.5 rounded-full text-xs";
  if (loading) return <p className="text-muted">Загрузка...</p>;

  const setRule = (i: number, p: Partial<ActRules["rules"][number]>) =>
    setAct((s) => ({ ...s, rules: s.rules.map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const exBonus = Math.min(act.max, act.rules.reduce((a, r) => a + r.bonus, 0));

  return (
    <div className="max-w-xl pb-24">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 mb-5 text-xs text-muted">
        Все цены здесь в <b className="text-offwhite">монетах</b>. 1 монета = <b className="text-offwhite">${coinUsd.toFixed(4)}</b> (меняется в «Монеты и Короны»). Курс сегодня: $1 = <b className="text-offwhite">{fx} {sym}</b> (меняется на Дашборде). Цена в монетах от курса не зависит.
        {cc ? " Цены правятся только для выбранной страны." : " Это общие цены (для стран без своих)."}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Подарки</h3>
      <label className="flex items-center gap-2 text-offwhite text-sm mb-2">
        <input
          type="checkbox"
          checked={fxSound}
          onChange={async (e) => {
            setFxSound(e.target.checked);
            await supabase.from("platform_settings").upsert({ key: "gift_fx_sound", value: e.target.checked ? "true" : "false" });
          }}
        />
        Звук эффектов подарков (для всех)
      </label>
      <div className="flex gap-2 overflow-x-auto mb-3">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex-none px-3 py-1.5 rounded-full text-sm border ${tab === t.k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-bgSurface border border-muted rounded-xl p-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-offwhite text-xs">Всем в этой вкладке:</span>
          <input value={pct} onChange={(e) => setPct(e.target.value)} className={`${cls} w-16`} />
          <span className="text-muted text-sm">%</span>
          <button onClick={() => bulk(1)} className={ghost}>+ поднять</button>
          <button onClick={() => bulk(-1)} className={ghost}>− снизить</button>
        </div>
        {list.length === 0 && <p className="text-muted text-sm py-3">Здесь пока нет подарков.</p>}
        {list.map((g) => (
          <div key={g.id} className={`py-2 border-t border-muted/40 ${isCh(g) ? "bg-gold/5" : ""}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <input value={g.name} onChange={(e) => patch(g.id, { name: e.target.value })} className={`${cls} flex-1 min-w-0 font-semibold`} />
              <label className="text-muted text-xs flex items-center gap-1 flex-none">
                <input type="checkbox" checked={g.is_active} onChange={(e) => patch(g.id, { is_active: e.target.checked })} /> в магазине
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={g.coins} inputMode="numeric" onChange={(e) => patch(g.id, { coins: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={`${cls} w-24 ${g.coins !== g.o.coins ? "border-gold" : ""}`} />
              <span className="text-muted text-xs">монет = <b className="text-success font-semibold">${(g.coins * coinUsd).toFixed(2)}</b> ≈ {Math.round(g.coins * coinUsd * fx * 100) / 100} {sym}</span>
              <span className="text-muted text-xs ml-auto">доля участницы</span>
              <input value={g.share} onChange={(e) => patch(g.id, { share: e.target.value })} className={`${cls} w-16`} />
              <span className="text-muted text-sm">%</span>
              <select value={g.fx} onChange={(e) => patch(g.id, { fx: e.target.value })} className={`${cls} py-1.5`} title="Эффект на экране">
                <option value="">эффект по умолчанию</option>
                <option value="off">без эффекта</option>
                <option value="mini">лёгкий эффект</option>
                <option value="full">на весь экран</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Голоса, буст, карточки, донаты и прочее</h3>
      <div className="mb-6">
        <AdminPricesPanel hideGifts />
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Выплаты участницам</h3>
      <div className="bg-bgSurface border border-muted rounded-xl p-3 mb-3">
        <p className="text-offwhite text-sm font-semibold mb-1">Обычная участница</p>
        <p className="text-muted text-xs">Получает долю, которая указана у каждой позиции (в строке подарка выше, у голосов и карточек в блоке ниже). Плюс бонусы за активность, они ниже.</p>
        <p className="text-offwhite text-sm font-semibold mt-3 mb-1">⭐ Амбассадор шоу</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-offwhite text-sm">Фиксированный процент выплат: </span>
          <input value={amb} onChange={(e) => setAmb(e.target.value)} placeholder="не задан" className={`${cls} w-20`} />
          <span className="text-muted text-sm">%</span>
          <span className="text-muted text-xs basis-full">Этот процент заменяет обычную долю на всё до конца шоу, бонусов активности у амбассадора нет. Статус назначается на одно шоу и снимается сам, когда оно закончится; на следующее шоу выдаётся заново в «Люди → Галочки и статусы».</span>
        </div>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-3 mb-3">
        <p className="text-offwhite text-sm font-semibold mb-1">Бонусы за активность <span className="text-muted text-xs font-normal">· только обычным участницам, за весь сезон шоу</span></p>
        <label className="flex items-center gap-1 mb-2 text-sm text-offwhite"><input type="checkbox" checked={act.regular} onChange={(e) => setAct({ ...act, regular: e.target.checked })} /> включить бонусы</label>
        {act.rules.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_72px] gap-2 items-center py-1.5 border-t border-muted/40 text-sm">
            <select value={r.kind} onChange={(e) => setRule(i, { kind: e.target.value as ActKind })} className={`${cls} w-full min-w-0`}>
              {ACT_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>{k.label}, не меньше ({k.unit})</option>
              ))}
            </select>
            <input value={r.min} onChange={(e) => setRule(i, { min: Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0)) })} className={`${cls} w-full min-w-0`} />
            <span className="flex items-center gap-1 text-muted">+<input value={r.bonus} onChange={(e) => setRule(i, { bonus: Math.max(0, Number(e.target.value) || 0) })} className={`${cls} w-full min-w-0`} />%</span>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button onClick={() => setAct({ ...act, rules: [...act.rules, { kind: "subscribers", min: 100, bonus: 1 }] })} className={ghost}>+ пункт</button>
          {act.rules.length > 0 && <button onClick={() => setAct({ ...act, rules: act.rules.slice(0, -1) })} className={ghost}>− убрать последний</button>}
          <span className="text-muted text-xs ml-2">Потолок всех бонусов: +</span>
          <input value={act.max} onChange={(e) => setAct({ ...act, max: Math.max(0, Number(e.target.value) || 0) })} className={`${cls} w-16`} />
          <span className="text-muted text-sm">%</span>
        </div>
        <p className="text-muted text-xs mt-2">Выполнила минимум по пункту, получает +% к своей доле. Бонусы разных пунктов складываются, но не больше потолка. Если выполнить все пункты, будет +{exBonus}%.</p>
      </div>
      <button onClick={savePayouts} className={btn}>Сохранить выплаты</button>

      <div className="fixed left-0 right-0 bottom-0 z-40 p-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-bgSurface border border-gold rounded-2xl px-4 py-2 flex items-center gap-3 shadow-lg">
          <span className="text-offwhite text-sm">{msg || `Изменено подарков: ${changed.length}`}</span>
          {changed.length > 0 && <button onClick={() => setGifts((a) => a.map((g) => ({ ...g, ...g.o })))} className={ghost}>Отменить</button>}
          <button onClick={saveAll} disabled={!changed.length} className={`${btn} ${changed.length ? "" : "opacity-40"}`}>Сохранить всё</button>
        </div>
      </div>
    </div>
  );
}
