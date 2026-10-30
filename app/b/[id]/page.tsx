"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import BusinessPageView, { BizPublic, BizProduct, BizOffer } from "@/components/BusinessPageView";
import { apiPost } from "@/lib/authClient";

// Публичная страница партнёра.
export default function BusinessPublicPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as any)?.id ?? "");
  const [p, setP] = useState<BizPublic | null>(null);
  const [extra, setExtra] = useState<{ products: BizProduct[]; offers: BizOffer[]; cur: string; mine: boolean; staff: boolean; notPublished: boolean; isHidden: boolean }>({ products: [], offers: [], cur: "₴", mine: false, staff: false, notPublished: false, isHidden: false });
  const [state, setState] = useState<"load" | "ok" | "none">("load");

  useEffect(() => {
    (async () => {
      const r = await apiPost("/api/business/page", { id });
      if (r?.ok) {
        // Для зрителей магазин живёт в профиле бизнес-аккаунта; здесь остаётся только предпросмотр для сотрудников.
        if (!r.staffPreview && r.userId) {
          router.replace(r.mine ? "/profile" : `/u/${r.userId}`);
          return;
        }
        setP(r.profile);
        setExtra({ products: r.products ?? [], offers: r.offers ?? [], cur: r.cur ?? "₴", mine: !!r.mine, staff: !!r.staffPreview, notPublished: !!r.notPublished, isHidden: !!r.isHidden });
        setState("ok");
      } else if (r?.error === "auth") {
        window.location.href = `/login?redirect=/b/${id}`;
      } else setState("none");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto">
        {state === "load" && <LoadingScreen inline />}
        {state === "none" && <p className="text-muted text-center px-6 py-10">Страница не найдена или пока недоступна.</p>}
        {state === "ok" && p && extra.staff && (
          <div className="mx-5 mb-3 rounded-xl border border-gold bg-gold/10 p-3 text-xs text-offwhite">
            <b className="text-gold">Предпросмотр для сотрудников.</b>{" "}
            {extra.isHidden ? "Страница скрыта от зрителей." : extra.notPublished ? "Партнёр ещё не опубликовал страницу, зрители её не видят." : "Так страницу видят зрители."}{" "}
            Можно пройти по всем кнопкам: заказ, бронь и подарок здесь только показываются и никуда не отправляются.
          </div>
        )}
        {state === "ok" && p && <BusinessPageView p={{ ...p, id }} products={extra.products} offers={extra.offers} cur={extra.cur} canOrder={!extra.mine && !extra.staff} demo={extra.staff} />}
      </div>
      <BottomNav />
    </main>
  );
}
