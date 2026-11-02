"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { money } from "@/lib/businessShared";
import { Dish, CartLine, unitPrice, modsText, missingRequired, MAX_LINE_QTY, modTypeLabel } from "@/lib/foodShared";

const ERR: Record<string, string> = {
  need_name: "Укажите имя.",
  need_phone: "Укажите телефон.",
  need_address: "Укажите адрес доставки.",
  dish_gone: "Одного из блюд уже нет в меню. Обновите страницу.",
  dish_out: "Одно из блюд закончилось. Уберите его из корзины.",
  need_sql: "Заказы еды ещё настраиваются. Попробуйте позже.",
  own_business: "Нельзя заказывать у самого себя.",
  empty_cart: "Корзина пуста.",
};

const lineKey = (dishId: string, mods: Record<string, string[]>) => dishId + "|" + JSON.stringify(Object.keys(mods).sort().map((k) => [k, [...mods[k]].sort()]));

// Меню ресторана: блюда по разделам, быстрый «+», опции, корзина одного заведения и оформление.
export default function FoodMenu({ businessId, shopName, dishes, cur, canOrder }: { businessId: string; shopName: string; dishes: Dish[]; cur: string; canOrder: boolean }) {
  const storeKey = `vt_food_${businessId}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<Dish | null>(null);
  const [mods, setMods] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [pickErr, setPickErr] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [method, setMethod] = useState<"courier" | "pickup">("courier");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pay, setPay] = useState<"cash" | "transfer">("cash");
  const [changeFrom, setChangeFrom] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setLines(arr.filter((l: any) => l && l.dishId && l.qty > 0));
      }
    } catch {}
  }, [storeKey]);
  function persist(next: CartLine[]) {
    setLines(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {}
  }

  useEffect(() => {
    if (!cartOpen || !canOrder) return;
    apiPost("/api/business/food", { action: "prefill", businessId }).then((r: any) => {
      if (r?.ok) {
        setName((c) => c || r.name || "");
        setPhone((c) => c || r.phone || "");
        setAddress((c) => c || r.address || "");
      }
    });
  }, [cartOpen, canOrder, businessId]);

  const byId: Record<string, Dish> = {};
  dishes.forEach((d) => (byId[d.id] = d));
  const valid = lines.filter((l) => byId[l.dishId] && byId[l.dishId].in_stock);
  const count = valid.reduce((a, l) => a + l.qty, 0);
  const total = Math.round(valid.reduce((a, l) => a + unitPrice(byId[l.dishId], l.mods) * l.qty, 0) * 100) / 100;
  const cats = Array.from(new Set(dishes.map((d) => d.category || "Другое")));
  const shown = dishes.filter((d) => !cat || (d.category || "Другое") === cat);

  function add(d: Dish, m: Record<string, string[]>, q: number) {
    const key = lineKey(d.id, m);
    const same = lines.find((l) => l.key === key);
    persist(same ? lines.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_LINE_QTY, l.qty + q) } : l)) : [...lines, { key, dishId: d.id, qty: q, mods: m }]);
  }
  function quickAdd(d: Dish) {
    if (!canOrder || !d.in_stock) return;
    if (d.modifiers.length) return openDish(d);
    add(d, {}, 1);
  }
  function openDish(d: Dish) {
    const init: Record<string, string[]> = {};
    d.modifiers.forEach((g) => (init[g.id] = g.type === "single" ? [g.options[0].name] : []));
    setMods(init);
    setQty(1);
    setPickErr("");
    setOpen(d);
  }
  function toggle(gid: string, type: string, n: string) {
    setMods((m) => {
      const cur2 = m[gid] ?? [];
      if (type === "single") return { ...m, [gid]: [n] };
      return { ...m, [gid]: cur2.includes(n) ? cur2.filter((x) => x !== n) : [...cur2, n] };
    });
  }
  function setLineQty(key: string, q: number) {
    persist(q <= 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_LINE_QTY, q) } : l)));
  }

  async function order() {
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/food", { action: "order", businessId, lines: valid.map((l) => ({ dishId: l.dishId, qty: l.qty, mods: l.mods })), method, name, phone, address, pay, changeFrom, comment });
    setBusy(false);
    if (r?.ok) {
      persist([]);
      setDone({ id: r.id, total: r.total });
    } else setErr(ERR[r?.error] ?? "Не получилось оформить. Попробуйте ещё раз.");
  }

  const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  const seg = (on: boolean) => `flex-1 py-2 rounded-full text-sm border ${on ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`;

  return (
    <div id="biz-menu" className="mt-4">
      {dishes.length === 0 && (
        <div className="bg-bgSurface border border-muted/60 rounded-xl p-4">
          <p className="text-muted text-xs">Меню пока пустое.</p>
        </div>
      )}
      {cats.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
          {["", ...cats].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} className={`flex-none px-3.5 py-1.5 rounded-full text-xs border whitespace-nowrap ${cat === c ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{c || "Все"}</button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {shown.map((d) => (
          <div key={d.id} className={`bg-bgSurface border border-gold/25 rounded-2xl p-2.5 flex gap-3 ${d.in_stock ? "" : "opacity-60"}`}>
            <button onClick={() => (canOrder && d.in_stock ? openDish(d) : undefined)} className="w-24 h-24 rounded-xl bg-bgPrimary overflow-hidden flex items-center justify-center text-3xl flex-none">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo_url} alt="" className={`w-full h-full object-cover ${d.in_stock ? "" : "grayscale"}`} />
              ) : (
                "🍽"
              )}
            </button>
            <div className="min-w-0 flex-1 flex flex-col">
              <p className="text-offwhite text-sm font-semibold break-words">{d.name}</p>
              {d.weight && <p className="text-muted text-xs">{d.weight}</p>}
              {d.description && <p className="text-muted text-xs break-words line-clamp-2">{d.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-gold text-sm font-bold">{d.modifiers.some((g) => g.type === "single") ? "от " : ""}{money(d.price, cur)}</span>
                {!d.in_stock ? (
                  <span className="text-danger text-xs">Закончилось</span>
                ) : canOrder ? (
                  <button onClick={() => quickAdd(d)} aria-label="Добавить" className="w-9 h-9 rounded-full bg-gold text-bgPrimary text-xl font-bold leading-none">+</button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {canOrder && count > 0 && !cartOpen && !open && (
        <div className="fixed left-0 right-0 bottom-20 z-40 px-5 flex justify-center">
          <button onClick={() => { setDone(null); setCartOpen(true); }} className="w-full max-w-md bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm shadow-lg">🛒 Корзина: {count} {count === 1 ? "блюдо" : count < 5 ? "блюда" : "блюд"} на {money(total, cur)}</button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-offwhite font-semibold break-words">{open.name}</p>
                <p className="text-muted text-xs">{open.weight}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-muted text-xl leading-none px-2">×</button>
            </div>
            {open.description && <p className="text-muted text-sm mb-3">{open.description}</p>}
            {open.modifiers.map((g) => (
              <div key={g.id} className="mb-3">
                <p className="text-offwhite text-sm font-semibold mb-1.5">{g.title} <span className="text-muted text-xs font-normal">· {modTypeLabel[g.type]}</span></p>
                <div className="flex flex-col gap-1.5">
                  {g.options.map((o) => {
                    const on = (mods[g.id] ?? []).includes(o.name);
                    return (
                      <button key={o.name} onClick={() => toggle(g.id, g.type, o.name)} className={`flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl border text-sm ${on ? "border-gold bg-gold/10 text-offwhite" : "border-muted text-offwhite"}`}>
                        <span className="flex items-center gap-2"><span className={`w-4 h-4 border flex-none ${g.type === "single" ? "rounded-full" : "rounded"} ${on ? "bg-gold border-gold" : "border-muted"}`} />{g.type === "remove" ? `Без: ${o.name}` : o.name}</span>
                        {o.price > 0 && <span className="text-gold text-xs flex-none">+{money(o.price, cur)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-full border border-muted text-offwhite">−</button>
              <span className="text-offwhite w-6 text-center">{qty}</span>
              <button onClick={() => setQty(Math.min(MAX_LINE_QTY, qty + 1))} className="w-9 h-9 rounded-full border border-muted text-offwhite">+</button>
            </div>
            {pickErr && <p className="text-danger text-xs mb-2">{pickErr}</p>}
            <button
              onClick={() => {
                const miss = missingRequired(open, mods);
                if (miss) return setPickErr(`Выберите: ${miss}`);
                add(open, mods, qty);
                setOpen(null);
              }}
              className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm"
            >
              Добавить · {money(unitPrice(open, mods) * qty, cur)}
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setCartOpen(false)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-2xl p-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-offwhite font-semibold">🛒 Заказ · {shopName}</p>
              <button onClick={() => setCartOpen(false)} className="text-muted text-xl leading-none px-2">×</button>
            </div>
            {done ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-offwhite font-semibold">Заказ отправлен</p>
                <p className="text-muted text-sm mt-1">Сумма {money(done.total, cur)}. Ресторан подтвердит заказ, вы получите уведомление.</p>
                <Link href={`/my-orders?o=${done.id}`} className="block bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm mt-4">Следить за заказом</Link>
              </div>
            ) : valid.length === 0 ? (
              <p className="text-muted text-sm py-6 text-center">Корзина пуста.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col">
                  {valid.map((l) => {
                    const d = byId[l.dishId];
                    return (
                      <div key={l.key} className="flex items-center gap-3 py-2 border-b border-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="text-offwhite text-sm font-semibold break-words">{d.name}</p>
                          {modsText(d, l.mods) && <p className="text-muted text-xs break-words">{modsText(d, l.mods)}</p>}
                          <p className="text-gold text-xs font-bold">{money(unitPrice(d, l.mods) * l.qty, cur)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-none">
                          <button onClick={() => setLineQty(l.key, l.qty - 1)} className="w-7 h-7 rounded-full border border-muted text-offwhite">−</button>
                          <span className="text-offwhite text-sm w-5 text-center">{l.qty}</span>
                          <button onClick={() => setLineQty(l.key, l.qty + 1)} className="w-7 h-7 rounded-full border border-muted text-offwhite">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMethod("courier")} className={seg(method === "courier")}>🚴 Доставка</button>
                  <button onClick={() => setMethod("pickup")} className={seg(method === "pickup")}>🏃 Самовывоз</button>
                </div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" maxLength={80} className={input} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" inputMode="tel" maxLength={40} className={input} />
                {method === "courier" && <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Адрес: улица, дом, квартира" maxLength={200} className={input} />}
                <div className="flex gap-2">
                  <button onClick={() => setPay("cash")} className={seg(pay === "cash")}>При получении</button>
                  <button onClick={() => setPay("transfer")} className={seg(pay === "transfer")}>Переводом на карту</button>
                </div>
                {pay === "cash" && <input value={changeFrom} onChange={(e) => setChangeFrom(e.target.value)} inputMode="decimal" placeholder="Нужна сдача с (необязательно)" maxLength={10} className={input} />}
                {pay === "transfer" && <p className="text-muted text-xs">Реквизиты ресторан пришлёт в чате заказа, когда примет его.</p>}
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={400} placeholder="Комментарий к заказу" className={input} />
                {err && <p className="text-danger text-xs">{err}</p>}
                <button onClick={order} disabled={busy} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Отправляем..." : `Оформить заказ · ${money(total, cur)}`}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
