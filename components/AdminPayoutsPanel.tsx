"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { loadScoped, scopedKey } from "@/lib/scopedSettings";
import { clearPricingCache } from "@/lib/currency";
import { ACT_DEFAULT, ACT_KEY, parseAct, type ActRules } from "@/lib/activity";
import { AMB_DEFAULT_KEY } from "@/lib/ambassador";
import { apiPost } from "@/lib/authClient";

// CRM → Деньги → «Цены и выплаты»: цена подарков в монетах (доллары считаются сами)
// и выплаты участницам: амбассадоры и повышение за активность.

type G = { id: string; name: string; category: string; chat_only: boolean; coins: number; orig: number; share: string; is_active: boolean };
const TABS: { k: string; label: string }[] = [
  { k: "light", label: "Лёгкие" },
  { k: "premium", label: "Премиум" },
  { k: "vip", label: "VIP" },
  { k: "chat", label: "Чатовые" },
];

export default function AdminPayoutsPanel() {
  const cc = getCrmCountry() || null;
  const [rate, setRate] = useState(41);
  const [rateStr, setRateStr] = useState("41");
  const [sym, setSym] = useState("₴");
  const [gifts, setGifts] = useState<G[]>([]);
  const [tab, setTab] = useState("light");
  const [pct, setPct] = useState("10");
  const [amb, setAmb] = useState("");
  const [act, setAct] = useState<ActRules>(ACT_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const m = await loadScoped(["usd_to_uah_rate"], cc);
    const r = Number(m.usd_to_uah_rate);
    const rt = Number.isFinite(r) && r > 0 ? r : 41;
    setRate(rt);
    setRateStr(String(rt));
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
        const coins = usd != null && Number(usd) > 0 ? Math.round(Number(usd) * rt) : Number(x0.price) || 0;
        return {
          id: x0.id,
          name: x0.name,
          category: x0.category,
          chat_only: !!x0.chat_only,
          coins,
          orig: coins,
          share: String(o?.participant_share_percent ?? x0.participant_share_percent ?? 50),
          is_active: o?.is_active ?? x0.is_active,
        } as G;
      })
    );
    const { data: ps } = await supabase.from("platform_settings").select("key, value").in("key", [AMB_DEFAULT_KEY, ACT_KEY]);
    const by: Record<string, string> = {};
    (ps ?? []).forEach((x: any) => (by[x.key] = x.value));
    setAmb(by[AMB_DEFAULT_KEY] ?? "");
    setAct(by[ACT_KEY] ? parseAct(by[ACT_KEY]) : ACT_DEFAULT);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const inTab = (g: G) => (tab === "chat" ? g.chat_only : !g.chat_only && g.category === tab);
  const list = useMemo(() => gifts.filter(inTab), [gifts, tab]);
  const changed = gifts.filter((g) => g.coins !== g.orig);

  function setCoins(id: string, v: string) {
    const n = Math.max(0, Math.round(Number(v) || 0));
    setGifts((a) => a.map((g) => (g.id === id ? { ...g, coins: n } : g)));
  }
  function bulk(sign: 1 | -1) {
    const p = (Number(pct) || 0) / 100;
    setGifts((a) => a.map((g) => (inTab(g) ? { ...g, coins: Math.max(1, Math.round(g.coins * (1 + sign * p))) } : g)));
  }

  async function saveAll() {
    setMsg("Сохраняю…");
    let fail = 0;
    for (const g of changed) {
      const usd = Math.round((g.coins / rate) * 10000) / 10000;
      const q = cc
        ? supabase.from("gift_country_prices").upsert({ gift_id: g.id, country_id: cc, usd_price: usd > 0 ? usd : null, participant_share_percent: Number(g.share) || 0, is_active: g.is_active })
        : supabase.from("gift_catalog").update({ usd_price: usd > 0 ? usd : null }).eq("id", g.id);
      const { error } = await q;
      if (error) fail++;
    }
    clearPricingCache();
    if (!fail) setGifts((a) => a.map((g) => ({ ...g, orig: g.coins })));
    setMsg(fail ? `Не сохранилось: ${fail}` : "Сохранено ✓");
    setTimeout(() => setMsg(""), 2500);
  }

  async function saveRate() {
    const r = Number(rateStr);
    if (!(r > 0)) return;
    await supabase.from("platform_settings").upsert({ key: scopedKey("usd_to_uah_rate", cc), value: String(r) });
    clearPricingCache();
    setRate(r);
    setMsg("Курс сохранён ✓");
    setTimeout(() => setMsg(""), 2000);
  }
  async function savePayouts() {
    const r: any = await apiPost("/api/admin/badges", { action: "amb_default", value: Number(amb) || 0 });
    if (!r?.ok) {
      setMsg(r?.error === "owner_only" ? "Бонус амбассадора может менять только владелец" : "Не удалось сохранить бонус амбассадора");
      setTimeout(() => setMsg(""), 3500);
      return;
    }
    await supabase.from("platform_settings").upsert({ key: ACT_KEY, value: JSON.stringify(act) });
    setMsg("Выплаты сохранены ✓");
    setTimeout(() => setMsg(""), 2500);
  }

  const cls = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm";
  const btn = "bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm";
  const ghost = "border border-gold text-gold px-3 py-1.5 rounded-full text-xs";
  if (loading) return <p className="text-muted">Загрузка...</p>;

  const setRule = (i: number, patch: Partial<ActRules["rules"][number]>) =>
    setAct((s) => ({ ...s, rules: s.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const exBonus = Math.min(act.max, act.rules.reduce((a, r) => a + r.bonus, 0));

  return (
    <div className="max-w-xl pb-24">
      <p className="text-muted text-xs mb-3">
        {cc ? "Цены правятся только для выбранной страны. " : "Общие цены (для стран без своих). "}
        Цену вводишь в монетах, доллары считаются сами по курсу.
      </p>

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 mb-5 flex flex-wrap items-center gap-2">
        <span className="text-offwhite text-sm">Курс: $1 =</span>
        <input value={rateStr} onChange={(e) => setRateStr(e.target.value)} className={`${cls} w-24`} />
        <span className="text-muted text-sm">{sym}</span>
        <button onClick={saveRate} className={ghost}>Сохранить курс</button>
        <span className="text-muted text-xs basis-full">1 монета = 1 {sym} цены подарка. Пересчёт монет, Корон и пополнения — в «Монеты и Короны».</span>
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Цены подарков</h3>
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
          <div key={g.id} className="grid grid-cols-[1fr_88px_1fr] gap-2 items-center py-2 border-t border-muted/40">
            <span className="text-offwhite text-sm min-w-0 truncate">{g.name}{!g.is_active && <span className="text-muted text-xs"> · скрыт</span>}</span>
            <input value={g.coins} inputMode="numeric" onChange={(e) => setCoins(g.id, e.target.value)} className={`${cls} w-full ${g.coins !== g.orig ? "border-gold" : ""}`} />
            <span className="text-xs text-muted leading-tight"><b className="text-success font-semibold">${(g.coins / rate).toFixed(2)}</b> · {g.coins} {sym}</span>
          </div>
        ))}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Выплаты участницам</h3>
      <div className="bg-bgSurface border border-muted rounded-xl p-3 mb-3">
        <p className="text-muted text-xs mb-2">Доля участницы у каждого подарка задаётся в «Цены в приложении». Здесь — добавки к ней.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-offwhite text-sm">⭐ Амбассадор: к доле + </span>
          <input value={amb} onChange={(e) => setAmb(e.target.value)} placeholder="0" className={`${cls} w-20`} />
          <span className="text-muted text-sm">п.п.</span>
          <span className="text-muted text-xs basis-full">Пример: доля подарка 50% + 10 = 60%. Отдельной амбассадору можно поставить своё число в «Галочки и статусы».</span>
        </div>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-3 mb-3">
        <p className="text-offwhite text-sm font-semibold mb-1">Повышение за активность <span className="text-muted text-xs font-normal">· за последние 30 дней</span></p>
        <div className="flex gap-4 mb-2 text-sm text-offwhite">
          <label className="flex items-center gap-1"><input type="checkbox" checked={act.regular} onChange={(e) => setAct({ ...act, regular: e.target.checked })} /> обычные участницы</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={act.amb} onChange={(e) => setAct({ ...act, amb: e.target.checked })} /> амбассадоры</label>
        </div>
        {act.rules.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_64px] gap-2 items-center py-1.5 border-t border-muted/40 text-sm">
            <select value={r.kind} onChange={(e) => setRule(i, { kind: e.target.value as any })} className={`${cls} w-full`}>
              <option value="posts">Постов ≥</option>
              <option value="invites">Приглашённых друзей ≥</option>
            </select>
            <input value={r.min} onChange={(e) => setRule(i, { min: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={`${cls} w-full`} />
            <span className="flex items-center gap-1 text-muted">+<input value={r.bonus} onChange={(e) => setRule(i, { bonus: Math.max(0, Number(e.target.value) || 0) })} className={`${cls} w-full`} />%</span>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button onClick={() => setAct({ ...act, rules: [...act.rules, { kind: "posts", min: 5, bonus: 1 }] })} className={ghost}>+ ступень</button>
          {act.rules.length > 0 && <button onClick={() => setAct({ ...act, rules: act.rules.slice(0, -1) })} className={ghost}>− убрать последнюю</button>}
          <span className="text-muted text-xs ml-2">Максимум за активность: +</span>
          <input value={act.max} onChange={(e) => setAct({ ...act, max: Math.max(0, Number(e.target.value) || 0) })} className={`${cls} w-16`} />
          <span className="text-muted text-sm">%</span>
        </div>
        <p className="text-muted text-xs mt-2">Если выполнены все ступени, добавится +{exBonus}% к доле подарка. Пока обе галочки выключены, активность ничего не меняет.</p>
      </div>
      <button onClick={savePayouts} className={btn}>Сохранить выплаты</button>

      <div className="fixed left-0 right-0 bottom-0 z-40 p-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-bgSurface border border-gold rounded-2xl px-4 py-2 flex items-center gap-3 shadow-lg">
          <span className="text-offwhite text-sm">{msg || `Изменено цен: ${changed.length}`}</span>
          {changed.length > 0 && <button onClick={() => setGifts((a) => a.map((g) => ({ ...g, coins: g.orig })))} className={ghost}>Отменить</button>}
          <button onClick={saveAll} disabled={!changed.length} className={`${btn} ${changed.length ? "" : "opacity-40"}`}>Сохранить всё</button>
        </div>
      </div>
    </div>
  );
}
