"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { cleanImage } from "@/lib/imageClean";
import { BODIES, FUELS, GEARBOXES, DRIVES, FEATURES, MAKES, CAR_STATUS, MAX_CAR_PHOTOS, Car, carTitle, carPrice, km } from "@/lib/carsShared";

const ERR: Record<string, string> = {
  empty_name: "Укажите марку и модель.",
  bad_price: "Проверьте цену.",
  bad_year: "Проверьте год выпуска.",
  need_sql: "Раздел ещё настраивается.",
};
const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
const EMPTY = { make: "", model: "", year: "", mileage_km: "", body: "", engine_vol: "", fuel: "", gearbox: "", drive: "", vin: "", features: [] as string[], price: "", currency: "USD", negotiable: false, description: "", photos: [] as string[], status: "available", is_active: true };

// Автомобили бизнеса: список и карточка с характеристиками, комплектацией и фото.
export default function CarsTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Car[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [ed, setEd] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await apiPost("/api/business/cars", { action: "list" });
    if (r?.unavailable) setUnavailable(true);
    setItems(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(files: FileList | null) {
    if (!files) return;
    setMsg("");
    setUpBusy(true);
    for (const file of Array.from(files)) {
      if (ed.photos.length >= MAX_CAR_PHOTOS) break;
      try {
        const up = await cleanImage(file);
        const path = `${userId}-${Date.now()}-car.${(up.name.split(".").pop() || "jpg").toLowerCase()}`;
        const { error } = await supabase.storage.from("participant-photos").upload(path, up);
        if (error) {
          setMsg("Ошибка загрузки: " + error.message);
          break;
        }
        const { data } = supabase.storage.from("participant-photos").getPublicUrl(path);
        setEd((c: any) => ({ ...c, photos: [...c.photos, data.publicUrl].slice(0, MAX_CAR_PHOTOS) }));
      } catch (e: any) {
        setMsg(e?.message || "Не удалось обработать фото.");
        break;
      }
    }
    setUpBusy(false);
  }

  async function save() {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/cars", { action: "save", ...ed });
    setBusy(false);
    if (r?.ok) {
      setItems(r.items);
      setEd(null);
    } else setMsg(ERR[r?.error] ?? "Не получилось сохранить. Попробуйте ещё раз.");
  }

  async function quick(c: Car, patch: Record<string, any>) {
    const r = await apiPost("/api/business/cars", { action: "save", ...c, ...patch });
    if (r?.ok) setItems(r.items);
  }

  if (!items) return <p className="text-muted text-sm">Загрузка...</p>;
  if (unavailable) return <p className="text-muted text-sm">Раздел ещё настраивается. Попробуйте позже.</p>;

  if (ed) {
    const set = (k: string) => (e: any) => setEd({ ...ed, [k]: e.target.value });
    const sel = (k: string, list: string[], ph: string) => (
      <select value={ed[k]} onChange={set(k)} className={input}>
        <option value="">{ph}</option>
        {list.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    );
    const toggleF = (f: string) => setEd({ ...ed, features: ed.features.includes(f) ? ed.features.filter((x: string) => x !== f) : [...ed.features, f] });
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => { setEd(null); setMsg(""); }} className="text-muted text-sm self-start">← Назад</button>
        <p className="text-offwhite font-semibold">{ed.id ? "Автомобиль" : "Новый автомобиль"}</p>

        <div>
          <p className="text-muted text-xs mb-1">Фото (до {MAX_CAR_PHOTOS}, первое главное, лучше горизонтальные)</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ed.photos.map((u: string, i: number) => (
              <div key={u} className="relative flex-none w-28 aspect-video rounded-lg overflow-hidden border border-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 bg-gold text-bgPrimary text-[10px] font-bold rounded px-1">главное</span>}
                <div className="absolute bottom-1 right-1 flex gap-1">
                  {i > 0 && <button onClick={() => setEd({ ...ed, photos: [u, ...ed.photos.filter((x: string) => x !== u)] })} className="bg-black/70 text-white text-[10px] rounded px-1.5 py-0.5">★</button>}
                  <button onClick={() => setEd({ ...ed, photos: ed.photos.filter((x: string) => x !== u) })} className="bg-black/70 text-white text-[10px] rounded px-1.5 py-0.5">×</button>
                </div>
              </div>
            ))}
            {ed.photos.length < MAX_CAR_PHOTOS && (
              <label className="flex-none w-28 aspect-video rounded-lg border border-dashed border-gold text-gold text-xs flex items-center justify-center text-center cursor-pointer">
                {upBusy ? "Грузим..." : "＋ Фото"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-muted text-xs flex flex-col gap-1">Марка<input list="car-makes" value={ed.make} onChange={set("make")} maxLength={40} className={input} /></label>
          <datalist id="car-makes">{MAKES.map((m) => <option key={m} value={m} />)}</datalist>
          <label className="text-muted text-xs flex flex-col gap-1">Модель<input value={ed.model} onChange={set("model")} maxLength={60} className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Год выпуска<input value={ed.year ?? ""} onChange={set("year")} inputMode="numeric" maxLength={4} className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Пробег, км<input value={ed.mileage_km ?? ""} onChange={set("mileage_km")} inputMode="numeric" className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Объём двигателя, л<input value={ed.engine_vol ?? ""} onChange={set("engine_vol")} inputMode="decimal" placeholder="3.0" className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Кузов{sel("body", BODIES, "Не указан")}</label>
          <label className="text-muted text-xs flex flex-col gap-1">Топливо{sel("fuel", FUELS, "Не указано")}</label>
          <label className="text-muted text-xs flex flex-col gap-1">Коробка{sel("gearbox", GEARBOXES, "Не указана")}</label>
          <label className="text-muted text-xs flex flex-col gap-1">Привод{sel("drive", DRIVES, "Не указан")}</label>
        </div>
        <label className="text-muted text-xs flex flex-col gap-1">VIN-код<input value={ed.vin ?? ""} onChange={set("vin")} maxLength={20} className={input + " uppercase"} /></label>

        <div>
          <p className="text-muted text-xs mb-1">Комплектация</p>
          <div className="flex flex-wrap gap-1.5">
            {FEATURES.map((f) => (
              <button key={f} onClick={() => toggleF(f)} className={`px-3 py-1.5 rounded-full text-xs border ${ed.features.includes(f) ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-muted text-xs flex flex-col gap-1">Цена<input value={ed.price} onChange={set("price")} inputMode="decimal" className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Валюта
            <select value={ed.currency} onChange={set("currency")} className={input}>
              <option value="USD">$ доллар</option>
              <option value="EUR">€ евро</option>
              <option value="UAH">₴ гривна</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={ed.negotiable} onChange={(e) => setEd({ ...ed, negotiable: e.target.checked })} />Возможен торг или кредит</label>
        <textarea value={ed.description ?? ""} onChange={set("description")} rows={4} maxLength={2000} placeholder="Описание, история, состояние" className={input} />
        <label className="text-muted text-xs flex flex-col gap-1">Статус
          <select value={ed.status} onChange={set("status")} className={input}>
            {Object.entries(CAR_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={ed.is_active} onChange={(e) => setEd({ ...ed, is_active: e.target.checked })} />Показывать клиентам</label>
        {msg && <p className="text-danger text-xs">{msg}</p>}
        <button disabled={busy || upBusy} onClick={save} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить автомобиль"}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setEd({ ...EMPTY })} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">＋ Выставить автомобиль</button>
      {items.length === 0 && <p className="text-muted text-sm">Пока пусто. Выставьте первый автомобиль: фото, характеристики и цена.</p>}
      {items.map((c) => (
        <div key={c.id} className={`bg-bgSurface border border-muted rounded-xl overflow-hidden ${c.is_active && c.status !== "sold" ? "" : "opacity-60"}`}>
          <button onClick={() => setEd({ ...c, year: c.year ?? "", mileage_km: c.mileage_km ?? "", engine_vol: c.engine_vol ?? "" })} className="w-full text-left flex gap-3 p-3">
            <div className="w-28 aspect-video rounded-lg bg-bgPrimary overflow-hidden flex-none flex items-center justify-center text-gold">
              {c.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                "🚗"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-offwhite text-sm font-semibold break-words">{carTitle(c)}</p>
              <p className="text-gold text-sm font-bold">{carPrice(c.price, c.currency)}</p>
              <p className="text-muted text-xs">{km(c.mileage_km)} · {CAR_STATUS[c.status]}{c.is_active ? "" : " · скрыт"}</p>
            </div>
          </button>
          <div className="flex gap-3 px-3 pb-2.5 text-xs">
            {c.status !== "sold" && <button onClick={() => quick(c, { status: "sold" })} className="text-gold underline">Отметить «Продано»</button>}
            <button onClick={() => quick(c, { is_active: !c.is_active })} className="text-muted underline">{c.is_active ? "Скрыть" : "Показать"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
