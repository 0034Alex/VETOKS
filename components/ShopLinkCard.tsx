"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";

type Shop = { id: string; user_id: string; name: string; logo_url: string | null };

// «Мой магазин»: ссылка на любимый магазин платформы в профиле любого человека.
// own — в своём профиле (можно выбрать и сменить), иначе только показываем чужую ссылку.
export default function ShopLinkCard({ own = false, shop: given = null }: { own?: boolean; shop?: Shop | null }) {
  const [shop, setShop] = useState<Shop | null>(given);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(!own);

  useEffect(() => {
    if (!own) return;
    apiPost("/api/business/myshop").then((r: any) => {
      if (r?.ok) setShop(r.shop ?? null);
      setReady(true);
    });
  }, [own]);

  async function openPicker() {
    setOpen(true);
    setMsg("");
    const r = await apiPost("/api/business/list");
    setList(r?.ok ? r.items ?? [] : []);
  }

  async function pick(id: string | null) {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/myshop", { action: "set", businessId: id });
    setBusy(false);
    if (r?.ok) {
      setShop(r.shop ?? null);
      setOpen(false);
    } else setMsg(r?.error === "no_column" ? "Функция ещё настраивается. Попробуйте позже." : "Не получилось. Попробуйте ещё раз.");
  }

  if (!ready) return null;
  // Чужой профиль без магазина: ничего не показываем. В своём: если магазинов нет и выбрать нечего, всё равно даём кнопку.
  if (!own && !shop) return null;

  const logo = (s: Shop) => (
    <span className="w-8 h-8 rounded-lg overflow-hidden bg-bgPrimary flex items-center justify-center text-gold text-xs font-bold flex-none">
      {s.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.logo_url} alt="" className="w-full h-full object-cover" />
      ) : (
        (s.name || "?").slice(0, 2).toUpperCase()
      )}
    </span>
  );

  return (
    <>
      <div className="px-5 mt-4">
        {shop ? (
          <div className="flex items-center gap-2">
            <Link href={`/u/${shop.user_id}`} className="flex-1 min-w-0 flex items-center gap-2.5 bg-bgSurface border border-gold/40 rounded-xl px-3 py-2">
              {logo(shop)}
              <span className="min-w-0">
                <span className="text-muted text-[11px] block leading-none">Мой магазин</span>
                <span className="text-offwhite text-sm font-semibold truncate block mt-0.5">{shop.name}</span>
              </span>
              <span className="text-gold ml-auto">›</span>
            </Link>
            {own && (
              <button onClick={openPicker} className="flex-none text-muted text-xs border border-muted/60 rounded-full px-3 py-2">Изменить</button>
            )}
          </div>
        ) : (
          <button onClick={openPicker} className="w-full text-left bg-bgSurface border border-muted/60 rounded-xl px-4 py-2.5 text-sm text-offwhite">
            🏪 Добавить «Мой магазин» <span className="text-muted text-xs">· любимый магазин платформы</span>
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end justify-center" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5 max-h-[80dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-offwhite font-semibold">Выберите магазин</p>
              <button onClick={() => setOpen(false)} className="text-muted text-xl">✕</button>
            </div>
            <p className="text-muted text-xs mb-3">Ссылка на него появится в вашем профиле, и друзья смогут сразу перейти в магазин.</p>
            {list.length === 0 && <p className="text-muted text-sm">Пока нет включённых магазинов.</p>}
            <div className="flex flex-col gap-2">
              {list.map((b) => (
                <button key={b.id} disabled={busy} onClick={() => pick(b.id)} className={`flex items-center gap-3 text-left rounded-xl p-2.5 border ${shop?.id === b.id ? "border-gold bg-gold/10" : "border-muted"}`}>
                  {logo({ id: b.id, user_id: b.user_id, name: b.name, logo_url: b.logo_url })}
                  <span className="min-w-0">
                    <span className="text-offwhite text-sm block truncate">{b.name}</span>
                    <span className="text-muted text-xs block truncate">{[b.category, b.address].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              ))}
            </div>
            {shop && (
              <button disabled={busy} onClick={() => pick(null)} className="w-full mt-3 border border-muted text-offwhite rounded-full py-2.5 text-sm">Убрать магазин из профиля</button>
            )}
            {msg && <p className="text-danger text-xs mt-2">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
