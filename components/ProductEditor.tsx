"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { cleanImage } from "@/lib/imageClean";
import { MAX_PHOTOS, ShopProduct, stockInfo } from "@/lib/businessShared";

const ERR: Record<string, string> = { empty_name: "Введите название.", bad_price: "Проверьте цену." };
const PRESETS = ["S", "M", "L", "XL", "XXL"];
const TONE = { ok: "text-success border-success/60", low: "text-gold border-gold/60", out: "text-danger border-danger/60" } as const;

// Окно «Выставить товар» / «Изменить товар»: до 5 фото, размеры с остатком, описание. Артикул даём сами.
export default function ProductEditor({ cur, userId, product, onClose, onSaved }: { cur: string; userId: string; product: ShopProduct | null; onClose: () => void; onSaved: () => void }) {
  const [photos, setPhotos] = useState<string[]>(product?.photos ?? []);
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [details, setDetails] = useState(product?.details ?? "");
  const [rows, setRows] = useState<{ k: string; n: string }[]>(
    product?.size_stock ? Object.entries(product.size_stock).map(([k, n]) => ({ k, n: String(n) })) : []
  );
  const [stock, setStock] = useState(product?.stock != null && !product?.size_stock ? String(product.stock) : "");
  const [active, setActive] = useState(product?.is_active !== false);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function addPhoto(file: File) {
    if (photos.length >= MAX_PHOTOS) return;
    setMsg("");
    setUpBusy(true);
    try {
      const up = await cleanImage(file);
      const path = `${userId}-${Date.now()}-prod.${(up.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, up);
      if (error) {
        setMsg("Ошибка загрузки: " + error.message);
      } else {
        const { data } = supabase.storage.from("participant-photos").getPublicUrl(path);
        setPhotos((p) => [...p, data.publicUrl].slice(0, MAX_PHOTOS));
      }
    } catch (e: any) {
      setMsg(e?.message || "Не удалось обработать фото.");
    }
    setUpBusy(false);
  }

  const useSizes = rows.length > 0;
  const total = useSizes ? rows.reduce((a, r) => a + Math.max(0, Math.floor(Number(r.n) || 0)), 0) : stock.trim() === "" ? null : Math.max(0, Math.floor(Number(stock) || 0));
  const st = stockInfo(total);

  async function save() {
    setBusy(true);
    setMsg("");
    const size_stock: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.k.trim();
      if (k) size_stock[k] = Math.max(0, Math.floor(Number(r.n) || 0));
    });
    const r = await apiPost("/api/business/manage", {
      action: "product_save",
      id: product?.id,
      name,
      price,
      description,
      details,
      photos,
      size_stock: Object.keys(size_stock).length ? size_stock : null,
      stock: useSizes ? null : stock,
      is_active: active,
    });
    setBusy(false);
    if (r?.ok) onSaved();
    else setMsg(ERR[r?.error] ?? "Не получилось сохранить. Попробуйте ещё раз.");
  }

  const inp = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  return (
    <div className="fixed inset-0 z-[130] bg-black/70 flex items-end justify-center" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md bg-bgSurface rounded-t-3xl max-h-[92dvh] overflow-y-auto border-t border-gold/50" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-offwhite font-semibold text-lg">{product ? "Изменить товар" : "Выставить товар"}</p>
          <button onClick={onClose} className="text-muted text-xl">✕</button>
        </div>
        <div className="px-5 flex flex-col gap-3">
          <div>
            <p className="text-muted text-xs mb-1.5">Фото (до {MAX_PHOTOS}). Первое видно в магазине, остальные при открытии товара.</p>
            <div className="flex gap-2 flex-wrap">
              {photos.map((u, i) => (
                <div key={u + i} className="relative w-[58px] h-[58px] rounded-xl overflow-hidden border border-gold/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute left-0 bottom-0 right-0 bg-black/70 text-gold text-[9px] text-center">главное</span>}
                  <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute right-0 top-0 w-5 h-5 bg-black/70 text-white text-[11px] rounded-bl-lg">✕</button>
                  {i > 0 && <button onClick={() => setPhotos((p) => [p[i], ...p.filter((_, j) => j !== i)])} className="absolute left-0 top-0 w-5 h-5 bg-black/70 text-gold text-[11px] rounded-br-lg" title="Сделать главным">★</button>}
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="w-[58px] h-[58px] rounded-xl border border-dashed border-gold text-gold flex items-center justify-center text-xl cursor-pointer">
                  {upBusy ? "…" : "＋"}
                  <input type="file" accept="image/*" className="hidden" disabled={upBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addPhoto(f); }} />
                </label>
              )}
            </div>
          </div>

          <label className="text-muted text-xs flex flex-col gap-1">Название<input className={inp} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Цена, {cur}<input className={inp} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Описание<textarea className={inp} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Характеристики (материал, состав, объём…)<input className={inp} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={600} /></label>

          <div>
            <p className="text-muted text-xs mb-1.5">Размеры или объёмы и сколько штук каждого. Без размеров можно не добавлять.</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {PRESETS.filter((p) => !rows.some((r) => r.k === p)).map((p) => (
                <button key={p} onClick={() => setRows((r) => [...r, { k: p, n: "" }])} className="px-3 py-1 rounded-full border border-muted text-offwhite text-xs">+ {p}</button>
              ))}
              <button onClick={() => setRows((r) => [...r, { k: "", n: "" }])} className="px-3 py-1 rounded-full border border-gold/60 text-gold text-xs">+ Свой</button>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2 mb-1.5 items-center">
                <input className={inp + " flex-1"} placeholder="Размер" value={r.k} maxLength={30} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, k: e.target.value } : y)))} />
                <input className={inp + " w-24"} placeholder="Шт." inputMode="numeric" value={r.n} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, n: e.target.value } : y)))} />
                <button onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-muted text-lg px-1">✕</button>
              </div>
            ))}
            {!useSizes && (
              <label className="text-muted text-xs flex flex-col gap-1 mt-1">Количество в наличии (пусто = без ограничения)
                <input className={inp} value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Статус в магазине (считается сам)</span>
            <span className={`px-3 py-1 rounded-full border font-semibold ${TONE[st.state]}`}>{st.label}</span>
          </div>
          <p className="text-muted text-xs">Артикул: {product?.sku ? <b className="text-offwhite">{product.sku}</b> : "будет присвоен автоматически"}</p>
          <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Показывать в магазине</label>
          {msg && <p className="text-danger text-sm">{msg}</p>}
          <button onClick={save} disabled={busy || upBusy || !name.trim()} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">
            {busy ? "Сохраняем..." : product ? "Сохранить" : "Выставить"}
          </button>
        </div>
      </div>
    </div>
  );
}
