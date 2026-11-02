"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

export type TagProduct = { id: string; name: string; price: number; photo: string | null; business_id: string; shop: string; cur: string };
const MAX_P = 5;
const MAX_S = 2;

// Отметка товаров магазинов в своём видео: до 5 товаров из 2 магазинов.
export default function ProductTagSheet({ value, onChange, onClose }: { value: TagProduct[]; onChange: (v: TagProduct[]) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<TagProduct[]>([]);
  const [hint, setHint] = useState("");
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setRes([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await apiPost("/api/post/products", { action: "search", q: s });
      if (r?.ok) setRes(r.items ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const shops = new Set(value.map((x) => x.business_id));
  function add(p: TagProduct) {
    if (value.some((x) => x.id === p.id)) return;
    if (value.length >= MAX_P) return setHint(`Не больше ${MAX_P} товаров.`);
    if (!shops.has(p.business_id) && shops.size >= MAX_S) return setHint(`Не больше ${MAX_S} магазинов.`);
    setHint("");
    onChange([...value, p]);
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/70" onClick={onClose}>
      <div className="w-full max-h-[80dvh] overflow-y-auto bg-bgSurface rounded-t-3xl px-4 pt-3" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
        <i className="block w-10 h-1 rounded-full bg-muted/50 mx-auto mb-3" />
        <p className="text-offwhite font-semibold mb-2">Товары из магазинов</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название товара или магазина…" autoFocus className="w-full bg-bgPrimary border border-gold/50 rounded-xl px-3.5 py-3 text-offwhite outline-none mb-2" />
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {value.map((p) => (
              <button key={p.id} onClick={() => onChange(value.filter((x) => x.id !== p.id))} className="bg-bgPrimary border border-gold/60 text-gold rounded-full px-3 py-1 text-sm">
                {p.name} · {p.shop} ×
              </button>
            ))}
          </div>
        )}
        {hint && <p className="text-danger text-xs mb-2">{hint}</p>}
        {res.map((p) => (
          <button key={p.id} disabled={value.some((x) => x.id === p.id)} onClick={() => add(p)} className="w-full flex items-center gap-3 py-2.5 border-b border-muted/20 text-left disabled:opacity-40">
            <span className="w-11 h-11 rounded-lg bg-bgPrimary bg-cover bg-center flex-none" style={p.photo ? { backgroundImage: `url(${p.photo})` } : undefined} />
            <span className="min-w-0 flex-1">
              <span className="block text-offwhite text-sm truncate">{p.name}</span>
              <span className="block text-muted text-xs truncate">{p.shop}</span>
            </span>
            <span className="text-gold text-sm flex-none">
              {p.price} {p.cur}
            </span>
          </button>
        ))}
        <button onClick={onClose} className="mt-4 w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full">
          Готово
        </button>
        <p className="text-muted text-xs mt-3">Под видео появится кнопка «Купить». До {MAX_P} товаров из {MAX_S} магазинов.</p>
      </div>
    </div>
  );
}
