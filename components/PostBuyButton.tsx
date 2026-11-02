"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";

type Prod = { id: string; name: string; price: number; photo: string | null; sizes: string[]; out: boolean };
type Shop = { business_id: string; name: string; logo_url: string | null; mine: boolean; cur: string; products: Prod[] };

// Кнопка «Купить» под видео участника: показывается, только если к посту отмечены товары.
export default function PostBuyButton({ postId }: { postId: string }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let off = false;
    (async () => {
      const r = await apiPost("/api/post/products", { action: "get", postId });
      if (!off && r?.ok) setShops(r.shops ?? []);
    })();
    return () => {
      off = true;
    };
  }, [postId]);
  if (!shops.length) return null;

  async function add(p: Prod) {
    setMsg("");
    if (p.sizes.length && !size[p.id]) return setMsg("Выберите размер.");
    const r = await apiPost("/api/business/cart", { action: "add", productId: p.id, size: size[p.id] || "", qty: 1, postId });
    if (r?.ok) setAdded((a) => ({ ...a, [p.id]: true }));
    else setMsg(r?.error === "own_business" ? "Это ваш магазин." : r?.error === "no_stock" ? "Нет в наличии." : r?.error === "need_size" ? "Выберите размер." : "Не получилось добавить.");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-gold text-bgPrimary rounded-full px-3 py-1 font-semibold text-[12px]">
        🛍 Купить
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70" onClick={() => setOpen(false)}>
          <div className="w-full max-h-[80dvh] overflow-y-auto bg-bgSurface rounded-t-3xl px-4 pt-3" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
            <i className="block w-10 h-1 rounded-full bg-muted/50 mx-auto mb-3" />
            <p className="text-offwhite font-semibold mb-2">Товары из видео</p>
            {shops.map((s) => (
              <div key={s.business_id} className="mb-3">
                <p className="text-muted text-xs uppercase tracking-wider mb-1">{s.name}</p>
                {s.products.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-muted/20">
                    <span className="w-14 h-14 rounded-lg bg-bgPrimary bg-cover bg-center flex-none" style={p.photo ? { backgroundImage: `url(${p.photo})` } : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-offwhite text-sm truncate">{p.name}</span>
                      <span className="block text-gold text-sm">
                        {p.price} {s.cur}
                      </span>
                      {p.sizes.length > 0 && !p.out && (
                        <span className="flex flex-wrap gap-1 mt-1">
                          {p.sizes.map((z) => (
                            <button key={z} onClick={() => setSize((m) => ({ ...m, [p.id]: z }))} className={`px-2 py-0.5 rounded-full border text-xs ${size[p.id] === z ? "border-gold text-gold" : "border-muted/50 text-muted"}`}>
                              {z}
                            </button>
                          ))}
                        </span>
                      )}
                    </span>
                    {p.out ? (
                      <span className="text-muted text-xs">Нет в наличии</span>
                    ) : s.mine ? (
                      <span className="text-muted text-xs">Ваш магазин</span>
                    ) : (
                      <button onClick={() => add(p)} disabled={added[p.id]} className="bg-gold text-bgPrimary rounded-full px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
                        {added[p.id] ? "В корзине" : "В корзину"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {msg && <p className="text-danger text-xs mb-2">{msg}</p>}
            <Link href="/cart" className="block text-center w-full border border-gold text-gold font-semibold py-3 rounded-full">
              Открыть корзину
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
