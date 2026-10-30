"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { money, ShopProduct, stockInfo, productTotal } from "@/lib/businessShared";
import ProductEditor from "@/components/ProductEditor";

const TONE = { ok: "text-success", low: "text-gold", out: "text-danger" } as const;

// Каталог партнёра в настройках: список товаров, скрыть/показать, изменить, выставить новый.
export default function BusinessCatalogTab({ cur, userId }: { cur: string; userId: string }) {
  const [items, setItems] = useState<ShopProduct[] | null>(null);
  const [edit, setEdit] = useState<ShopProduct | null | "new">(null);

  async function load() {
    const r = await apiPost("/api/business/manage", { action: "products" });
    setItems(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
    try {
      if (new URLSearchParams(window.location.search).get("new")) setEdit("new");
    } catch {}
  }, []);

  async function toggle(p: ShopProduct) {
    await apiPost("/api/business/manage", { action: "product_save", ...p, is_active: !p.is_active });
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setEdit("new")} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">＋ Выставить товар</button>
      {!items && <p className="text-muted text-sm">Загрузка...</p>}
      {items && items.length === 0 && <p className="text-muted text-sm">Каталог пуст. Выставьте первый товар или услугу.</p>}
      {items?.map((p) => {
        const st = stockInfo(productTotal(p));
        return (
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
              <p className="text-muted text-xs">{[p.sku && `ID ${p.sku}`, p.photos.length > 1 && `${p.photos.length} фото`].filter(Boolean).join(" · ")}</p>
              <p className="text-sm"><span className="text-gold">{money(p.price, cur)}</span> <span className={`text-xs ${TONE[st.state]}`}>· {st.label}</span></p>
            </div>
            <div className="flex flex-col gap-1.5 items-end flex-none">
              <button onClick={() => setEdit(p)} className="text-gold text-xs underline">Изменить</button>
              <button onClick={() => toggle(p)} className="text-muted text-xs underline">{p.is_active ? "Скрыть" : "Показать"}</button>
            </div>
          </div>
        );
      })}
      {edit && (
        <ProductEditor
          cur={cur}
          userId={userId}
          product={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}
