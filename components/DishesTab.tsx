"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { cleanImage } from "@/lib/imageClean";
import { money } from "@/lib/businessShared";
import { Dish, ModGroup, modTypeLabel } from "@/lib/foodShared";

const ERR: Record<string, string> = { empty_name: "Введите название блюда.", bad_price: "Проверьте цену.", need_sql: "Раздел ещё настраивается." };
const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
const CATS = ["Пицца", "Суши", "Роллы", "Салаты", "Супы", "Горячее", "Бургеры", "Десерты", "Напитки"];

// Меню ресторана: блюда, вес, цена, фото и модификаторы (размер, добавки, «убрать»).
export default function DishesTab({ cur, userId }: { cur: string; userId: string }) {
  const [items, setItems] = useState<Dish[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [ed, setEd] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await apiPost("/api/business/dishes", { action: "list" });
    if (r?.unavailable) setUnavailable(true);
    setItems(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(file: File) {
    setMsg("");
    setUpBusy(true);
    try {
      const up = await cleanImage(file);
      const path = `${userId}-${Date.now()}-dish.${(up.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, up);
      if (error) setMsg("Ошибка загрузки: " + error.message);
      else setEd((c: any) => ({ ...c, photo_url: supabase.storage.from("participant-photos").getPublicUrl(path).data.publicUrl }));
    } catch (e: any) {
      setMsg(e?.message || "Не удалось обработать фото.");
    }
    setUpBusy(false);
  }

  async function save(body: any, close = true) {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/dishes", { action: "save", ...body });
    setBusy(false);
    if (r?.ok) {
      setItems(r.items);
      if (close) setEd(null);
    } else setMsg(ERR[r?.error] ?? "Не получилось сохранить. Попробуйте ещё раз.");
  }

  if (!items) return <p className="text-muted text-sm">Загрузка...</p>;
  if (unavailable) return <p className="text-muted text-sm">Раздел ещё настраивается. Попробуйте позже.</p>;

  if (ed) {
    const set = (k: string) => (e: any) => setEd({ ...ed, [k]: e.target.value });
    const groups: ModGroup[] = ed.modifiers;
    const setG = (i: number, g: ModGroup) => setEd({ ...ed, modifiers: groups.map((x, j) => (j === i ? g : x)) });
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => { setEd(null); setMsg(""); }} className="text-muted text-sm self-start">← Назад</button>
        <p className="text-offwhite font-semibold">{ed.id ? "Блюдо" : "Новое блюдо"}</p>
        <div className="flex items-center gap-3">
          <span className="w-20 h-20 rounded-xl overflow-hidden bg-bgSurface border border-gold/40 flex items-center justify-center text-2xl flex-none">
            {ed.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ed.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              "🍽"
            )}
          </span>
          <label className="border border-gold text-gold rounded-full px-4 py-2 text-sm cursor-pointer">
            {upBusy ? "Грузим..." : "Загрузить фото"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
        <input value={ed.name} onChange={set("name")} placeholder="Название (например, Пицца Баварская)" maxLength={100} className={input} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-muted text-xs flex flex-col gap-1">Цена, {cur}<input value={ed.price} onChange={set("price")} inputMode="decimal" className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Вес или объём<input value={ed.weight ?? ""} onChange={set("weight")} placeholder="450 г" maxLength={30} className={input} /></label>
        </div>
        <label className="text-muted text-xs flex flex-col gap-1">Раздел меню<input list="dish-cats" value={ed.category ?? ""} onChange={set("category")} placeholder="Пицца, Суши, Напитки" maxLength={40} className={input} /></label>
        <datalist id="dish-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist>
        <textarea value={ed.description ?? ""} onChange={set("description")} rows={2} maxLength={500} placeholder="Состав" className={input} />

        <div className="flex flex-col gap-3">
          <p className="text-offwhite text-sm font-semibold">Модификаторы</p>
          {groups.map((g, i) => (
            <div key={i} className="border border-muted rounded-xl p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input value={g.title} onChange={(e) => setG(i, { ...g, title: e.target.value })} placeholder="Название группы (диаметр, добавки)" maxLength={60} className={input} />
                <button onClick={() => setEd({ ...ed, modifiers: groups.filter((_, j) => j !== i) })} className="text-danger text-xs flex-none px-1">Убрать</button>
              </div>
              <select value={g.type} onChange={(e) => setG(i, { ...g, type: e.target.value as ModGroup["type"] })} className={input}>
                {Object.entries(modTypeLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              {g.options.map((o, k) => (
                <div key={k} className="flex gap-2">
                  <input value={o.name} onChange={(e) => setG(i, { ...g, options: g.options.map((x, y) => (y === k ? { ...x, name: e.target.value } : x)) })} placeholder={g.type === "remove" ? "Без чего (лук, кинза)" : "Вариант"} maxLength={60} className={input} />
                  {g.type !== "remove" && <input value={o.price} onChange={(e) => setG(i, { ...g, options: g.options.map((x, y) => (y === k ? { ...x, price: e.target.value as any } : x)) })} inputMode="decimal" placeholder="+0" className={input + " max-w-[5.5rem]"} />}
                  <button onClick={() => setG(i, { ...g, options: g.options.filter((_, y) => y !== k) })} className="text-muted text-lg flex-none px-1">×</button>
                </div>
              ))}
              <button onClick={() => setG(i, { ...g, options: [...g.options, { name: "", price: 0 }] })} className="text-gold text-xs self-start">＋ Добавить вариант</button>
            </div>
          ))}
          <button onClick={() => setEd({ ...ed, modifiers: [...groups, { id: "g" + (groups.length + 1) + Date.now().toString(36), title: "", type: "multi", options: [{ name: "", price: 0 }] }] })} className="border border-gold text-gold rounded-full py-2 text-sm">＋ Добавить группу</button>
          <p className="text-muted text-[11px]">Пример: «Диаметр» (обязательный выбор: 30 см, 40 см +80), «Добавки» (двойной сыр +30), «Убрать» (лук, кинза).</p>
        </div>

        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={ed.in_stock} onChange={(e) => setEd({ ...ed, in_stock: e.target.checked })} />Есть в наличии (снимите, если закончилось)</label>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={ed.is_active} onChange={(e) => setEd({ ...ed, is_active: e.target.checked })} />Показывать в меню</label>
        {msg && <p className="text-danger text-xs">{msg}</p>}
        <button disabled={busy || upBusy} onClick={() => save(ed)} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить блюдо"}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setEd({ name: "", price: "", weight: "", category: "", description: "", photo_url: null, modifiers: [], in_stock: true, is_active: true })} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">＋ Добавить блюдо</button>
      {items.length === 0 && <p className="text-muted text-sm">Меню пусто. Добавьте первое блюдо с ценой и фото.</p>}
      {items.map((d) => (
        <div key={d.id} className={`bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3 ${d.is_active ? "" : "opacity-60"}`}>
          <button onClick={() => setEd({ ...d })} className="flex items-center gap-3 min-w-0 flex-1 text-left">
            <span className="w-14 h-14 rounded-lg bg-bgPrimary overflow-hidden flex items-center justify-center text-xl flex-none">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                "🍽"
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-offwhite text-sm font-semibold break-words">{d.name}</span>
              <span className="block text-muted text-xs">{[d.category, d.weight].filter(Boolean).join(" · ")}{d.modifiers.length ? " · есть опции" : ""}{d.is_active ? "" : " · скрыто"}</span>
              <span className="block text-gold text-sm font-bold">{money(d.price, cur)}</span>
            </span>
          </button>
          <button onClick={() => save({ ...d, in_stock: !d.in_stock }, false)} className={`flex-none text-xs rounded-full border px-2.5 py-1 ${d.in_stock ? "border-success/60 text-success" : "border-danger/60 text-danger"}`}>{d.in_stock ? "В наличии" : "Стоп"}</button>
        </div>
      ))}
    </div>
  );
}
