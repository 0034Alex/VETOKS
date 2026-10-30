"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import BusinessPageView, { BizPublic, BizProduct, BizOffer } from "@/components/BusinessPageView";

// Магазин внутри профиля бизнес-аккаунта: выглядит как часть обычной страницы, а не как настройки.
export default function ShopSection({ userId, owner = false }: { userId: string; owner?: boolean }) {
  const [d, setD] = useState<{ p: BizPublic; products: BizProduct[]; offers: BizOffer[]; cur: string; mine: boolean; notPublished: boolean; staff: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await apiPost("/api/business/page", { userId });
    if (r?.ok) setD({ p: { ...r.profile, user_id: r.userId }, products: r.products ?? [], offers: r.offers ?? [], cur: r.cur ?? "₴", mine: !!r.mine, notPublished: !!r.notPublished, staff: !!r.staffPreview });
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function enable() {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/save", { is_active: true });
    setBusy(false);
    if (r?.ok) {
      setMsg("Магазин включён, теперь его видят все.");
      load();
    } else if (r?.error === "need_contact") setMsg("Чтобы включить, укажите телефон или почту в настройках магазина.");
    else setMsg("Не получилось включить. Откройте настройки магазина.");
  }

  if (!d) return null;
  return (
    <div className="mt-2">
      {owner && d.notPublished && (
        <div className="mx-5 mt-4 rounded-xl border border-gold bg-gold/10 p-4">
          <p className="text-offwhite text-sm font-semibold">Магазин пока скрыт от зрителей</p>
          <p className="text-muted text-xs mt-1">Заполните данные и каталог в настройках, затем включите. Так магазин увидят все.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={enable} disabled={busy} className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">
              {busy ? "Включаем..." : "Включить магазин"}
            </button>
            <a href="/business" className="flex-1 text-center border border-gold text-gold font-semibold rounded-full py-2.5 text-sm">Настройки</a>
          </div>
          {msg && <p className="text-gold text-xs mt-2">{msg}</p>}
        </div>
      )}
      {owner && !d.notPublished && msg && <p className="mx-5 mt-3 text-gold text-xs">{msg}</p>}
      <div className="mx-5 mt-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-muted/40" />
        <span className="text-muted text-[11px] tracking-wide">МАГАЗИН</span>
        <span className="h-px flex-1 bg-muted/40" />
      </div>
      <BusinessPageView bare p={d.p} products={d.products} offers={d.offers} cur={d.cur} preview={owner} canOrder={!owner && !d.mine && !d.staff} demo={d.staff && !owner} />
    </div>
  );
}
