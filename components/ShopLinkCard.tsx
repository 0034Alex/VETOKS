"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { BizMark } from "@/components/BusinessPageView";

type Shop = { id: string; user_id: string; name: string; logo_url: string | null };

const Logo = ({ s }: { s: Shop }) => (
  <span className="w-9 h-9 rounded-lg overflow-hidden bg-bgPrimary flex items-center justify-center text-gold text-xs font-bold flex-none">
    {s.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.logo_url} alt="" className="w-full h-full object-cover" />
    ) : (
      (s.name || "?").slice(0, 2).toUpperCase()
    )}
  </span>
);

// Полоса «Магазин» в профиле, на всю ширину, ниже соцсетей и каналов.
// Без параметров: свой профиль (берём из настроек). shop: чужой профиль. picker: выбор магазина в настройках.
export default function ShopLinkCard({ own = false, shop: given = null, picker = false }: { own?: boolean; shop?: Shop | null; picker?: boolean }) {
  const [shop, setShop] = useState<Shop | null>(given);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(!(own || picker));

  useEffect(() => {
    if (!(own || picker)) return;
    apiPost("/api/business/myshop").then((r: any) => {
      if (r?.ok) setShop(r.shop ?? null);
      setReady(true);
    });
  }, [own, picker]);

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

  if (picker) {
    return (
      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-1">Мой магазин</p>
        <p className="text-muted text-xs mb-3">Выберите любимый магазин платформы. В вашем профиле появится полоса со ссылкой на него, её увидят все.</p>
        {shop ? (
          <div className="flex items-center gap-3">
            <Logo s={shop} />
            <span className="flex-1 min-w-0 truncate text-offwhite text-sm">{shop.name}</span>
            <button onClick={openPicker} className="text-gold text-xs underline">Изменить</button>
            <button onClick={() => pick(null)} disabled={busy} className="text-danger text-xs">Убрать</button>
          </div>
        ) : (
          <button onClick={openPicker} className="w-full bg-gold text-bgPrimary font-semibold rounded-xl py-2.5 text-sm">Выбрать магазин</button>
        )}
        {msg && <p className="text-danger text-xs mt-2">{msg}</p>}
        {open && (
          <div className="fixed inset-0 z-[200] bg-black/70 flex items-end justify-center" onClick={() => !busy && setOpen(false)}>
            <div className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5 max-h-[80dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-offwhite font-semibold">Выберите магазин</p>
                <button onClick={() => setOpen(false)} className="text-muted text-xl">✕</button>
              </div>
              {list.length === 0 && <p className="text-muted text-sm">Пока нет включённых магазинов.</p>}
              <div className="flex flex-col gap-2">
                {list.map((b) => (
                  <button key={b.id} disabled={busy} onClick={() => pick(b.id)} className={`flex items-center gap-3 text-left rounded-xl p-2.5 border ${shop?.id === b.id ? "border-gold bg-gold/10" : "border-muted"}`}>
                    <Logo s={{ id: b.id, user_id: b.user_id, name: b.name, logo_url: b.logo_url }} />
                    <span className="min-w-0">
                      <span className="text-offwhite text-sm block truncate">{b.name}</span>
                      <span className="text-muted text-xs block truncate">{[b.category, b.address].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                ))}
              </div>
              {msg && <p className="text-danger text-xs mt-2">{msg}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!shop) return null;
  return (
    <div className="px-5 mt-4">
      <Link href={`/u/${shop.user_id}`} className="flex items-center gap-3 w-full bg-gradient-to-r from-gold/15 to-transparent border border-gold/50 rounded-xl px-3.5 py-2.5">
        <Logo s={shop} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-gold text-[10px] font-bold tracking-widest"><BizMark size={12} /> МАГАЗИН</span>
          <span className="text-offwhite text-sm font-semibold truncate block mt-0.5">{shop.name}</span>
        </span>
        <span className="text-gold text-xs flex-none">Открыть ›</span>
      </Link>
    </div>
  );
}
