"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { cleanImage } from "@/lib/imageClean";
import { money } from "@/lib/businessShared";

const EMPTY = { id: "", sku: "", name: "", description: "", price: "", photo_url: "", sizes: "", stock: "", is_active: true };
const ERR: Record<string, string> = { empty_name: "Введите название.", bad_price: "Проверьте цену." };

// Каталог партнёра: товары с артикулом, размерами, остатком и фото.
export default function BusinessCatalogTab({ cur, userId }: { cur: string; userId: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [f, setF] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await apiPost("/api/business/manage", { action: "products" });
    setItems(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/manage", { action: "product_save", ...f });
    setBusy(false);
    if (r?.ok) {
      setF(null);
      load();
    } else setMsg(ERR[r?.error] ?? "Не получилось сохранить.");
  }

  async function toggle(p: any) {
    await apiPost("/api/business/manage", { action: "product_save", ...p, price: p.price, is_active: !p.is_active });
    load();
  }

  async function photo(file: File) {
    setMsg("");
    try {
      const up = await cleanImage(file);
      const path = `biz-${userId}-prod-${Date.now()}.${up.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, up);
      if (error) return setMsg("Ошибка загрузки: " + error.message);
      const { data } = supabase.storage.from("participant-photos").getPublicUrl(path);
      setF((o: any) => ({ ...o, photo_url: data.publicUrl }));
    } catch (e: any) {
      setMsg(e?.message || "Не удалось обработать фото.");
    }
  }

  const inp = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  const set = (k: string) => (e: any) => setF((o: any) => ({ ...o, [k]: e.target.value }));

  if (f) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setF(null)} className="text-muted text-sm self-start">← К каталогу</button>
        <label className="bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3 cursor-pointer">
          <div className="w-16 h-16 rounded-lg bg-bgPrimary overflow-hidden flex items-center justify-center text-muted text-xs flex-none">
            {f.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              "Фото"
            )}
          </div>
          <span className="text-gold text-sm">{f.photo_url ? "Заменить фото" : "Загрузить фото"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} />
        </label>
        <label className="text-muted text-xs flex flex-col gap-1">Название<input className={inp} value={f.name} onChange={set("name")} maxLength={120} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-muted text-xs flex flex-col gap-1">Артикул (ID)<input className={inp} value={f.sku} onChange={set("sku")} maxLength={40} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Цена, {cur}<input className={inp} value={f.price} onChange={set("price")} inputMode="decimal" /></label>
        </div>
        <label className="text-muted text-xs flex flex-col gap-1">Размеры или объёмы через запятую (например S, M, L)<input className={inp} value={f.sizes} onChange={set("sizes")} maxLength={200} /></label>
        <label className="text-muted text-xs flex flex-col gap-1">Остаток, шт. (пусто = без ограничения)<input className={inp} value={f.stock ?? ""} onChange={set("stock")} inputMode="numeric" /></label>
        <label className="text-muted text-xs flex flex-col gap-1">Описание<textarea className={inp} rows={3} value={f.description} onChange={set("description")} maxLength={1000} /></label>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={!!f.is_active} onChange={(e) => setF((o: any) => ({ ...o, is_active: e.target.checked }))} /> Показывать на странице</label>
        <button onClick={save} disabled={busy} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить товар"}</button>
        {msg && <p className="text-danger text-sm">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setF({ ...EMPTY })} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">+ Добавить товар</button>
      {!items && <p className="text-muted text-sm">Загрузка...</p>}
      {items && items.length === 0 && <p className="text-muted text-sm">Каталог пуст. Добавьте первый товар или услугу.</p>}
      {items?.map((p) => (
        <div key={p.id} className={`bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3 ${p.is_active ? "" : "opacity-60"}`}>
          <div className="w-14 h-14 rounded-lg bg-bgPrimary overflow-hidden flex items-center justify-center text-gold font-bold flex-none">
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (p.name || "?").slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-offwhite text-sm font-semibold break-words">{p.name}</p>
            <p className="text-muted text-xs">{[p.sku && `ID ${p.sku}`, p.sizes, p.stock != null ? `остаток ${p.stock}` : ""].filter(Boolean).join(" · ")}</p>
            <p className="text-gold text-sm">{money(p.price, cur)}</p>
          </div>
          <div className="flex flex-col gap-1.5 items-end flex-none">
            <button onClick={() => setF({ ...p, price: String(p.price), sku: p.sku ?? "", description: p.description ?? "", photo_url: p.photo_url ?? "", sizes: p.sizes ?? "", stock: p.stock ?? "" })} className="text-gold text-xs underline">Изменить</button>
            <button onClick={() => toggle(p)} className="text-muted text-xs underline">{p.is_active ? "Скрыть" : "Показать"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
