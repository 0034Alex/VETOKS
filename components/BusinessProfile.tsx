"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";
import { shareLink, TopBtn } from "@/components/ProfileHero";
import { SocialIcon, socialKind } from "@/lib/socialLinks";
import FollowsSheet from "@/components/FollowsSheet";
import ProductEditor from "@/components/ProductEditor";
import BusinessPageView, { BizPublic, BizProduct, BizOffer, BlueCheck } from "@/components/BusinessPageView";
import ShopReportSheet from "@/components/ShopReportSheet";

type Extra = { followers: number; following: number; purchases: number; isFollowing: boolean; socials: string[]; canWrite: boolean };
type Data = { p: BizPublic; products: BizProduct[]; offers: BizOffer[]; cur: string; mine: boolean; notPublished: boolean; staff: boolean; extra: Extra };

const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : n.toLocaleString("ru-RU"));

// Страница магазина как профиль: баннер, логотип, подписчики, контакты, вкладки «Магазин / Лента / О магазине».
// owner — это мой бизнес-аккаунт (есть «＋ Выставить товар» и настройки), иначе вид для зрителя.
export default function BusinessProfile({
  userId,
  owner = false,
  topLeft,
  topRight,
  newOrders = 0,
}: {
  userId: string;
  owner?: boolean;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  newOrders?: number;
}) {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState<"followers" | "following" | null>(null);
  const [follow, setFollow] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [fBusy, setFBusy] = useState(false);
  const [edit, setEdit] = useState<BizProduct | null | "new">(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  async function load() {
    const r = await apiPost("/api/business/page", { userId });
    if (r?.ok) {
      const ex: Extra = r.extra ?? { followers: 0, following: 0, purchases: 0, isFollowing: false, socials: [], canWrite: true };
      setD({ p: { ...r.profile, user_id: r.userId }, products: r.products ?? [], offers: r.offers ?? [], cur: r.cur ?? "₴", mine: !!r.mine, notPublished: !!r.notPublished, staff: !!r.staffPreview, extra: ex });
      setFollow(ex.isFollowing);
      setFollowers(ex.followers);
    } else setMissing(true);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function say(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  }

  async function share() {
    const r = await shareLink(window.location.origin + `/u/${userId}`, d?.p.name ?? "Магазин");
    if (r === "copied") say("Ссылка скопирована");
  }

  async function toggleFollow() {
    if (fBusy) return;
    setFBusy(true);
    const r = await apiPost("/api/profile/follow", { userId, on: !follow });
    if (r?.ok) {
      setFollow(r.on);
      setFollowers((n) => Math.max(0, n + (r.on ? 1 : -1)));
    }
    setFBusy(false);
  }

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

  if (missing) return <p className="text-muted text-center px-6 py-16">Магазин не найден или пока недоступен.</p>;
  if (!d) return <div className="min-h-[60vh]" />;
  const { p, extra } = d;
  const btn = "flex-1 min-w-0 h-11 rounded-full text-[14px] font-semibold flex items-center justify-center";

  return (
    <div>
      <div className="relative h-[220px] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(201,162,39,0.3))" }}>
        {p.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(11,11,13,.5) 0%,rgba(11,11,13,0) 30%,rgba(11,11,13,0) 55%,#0B0B0D 100%)" }} />
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}>
          <div>{topLeft}</div>
          <div className="flex items-center gap-1.5">
            {owner && (
              <>
                <TopBtn onClick={() => setEdit("new")} label="Выставить товар">
                  <span className="text-2xl leading-none text-goldSoft">＋</span>
                </TopBtn>
                <TopBtn href="/business" label="Настройки магазина" badge={newOrders}>
                  <span className="text-lg leading-none">⚙</span>
                </TopBtn>
              </>
            )}
            {!owner && (
              <>
                <TopBtn onClick={share} label="Поделиться">
                  <span className="text-lg leading-none">↗</span>
                </TopBtn>
                {!d.staff && p.id && (
                  <TopBtn onClick={() => setReportOpen(true)} label="Пожаловаться на магазин">
                    <span className="text-base leading-none">⚑</span>
                  </TopBtn>
                )}
              </>
            )}
            {topRight}
          </div>
        </div>
      </div>

      <div className="px-5 -mt-12 relative z-10 flex gap-3 items-start">
        <div className="w-[92px] h-[92px] rounded-full border-2 border-gold bg-bgPrimary overflow-hidden flex items-center justify-center flex-none relative shadow-[0_0_24px_rgba(201,162,39,.25)]">
          {p.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-gold text-2xl font-bold">{(p.name || "?").slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-14">
          <h1 className="text-offwhite text-xl font-semibold flex items-center gap-2 flex-wrap">
            <span className="min-w-0 break-words">{p.name}</span>
            {p.verified && <BlueCheck />}
          </h1>
        </div>
      </div>
      {p.category && <p className="px-5 mt-2 text-offwhite text-sm">{p.category}</p>}

      <div className="px-5 mt-4 flex gap-2">
        {owner ? (
          <>
            <Link href="/business?tab=orders" className={`${btn} relative bg-gold text-bgPrimary`}>
              Заказы
              {newOrders > 0 && <span className="absolute -top-1.5 -right-1 bg-danger text-white text-[10px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center">{newOrders > 9 ? "9+" : newOrders}</span>}
            </Link>
            <button onClick={share} aria-label="Поделиться" className="flex-none w-11 h-11 rounded-full border border-muted/60 bg-bgSurface text-offwhite">↗</button>
          </>
        ) : (
          <>
            <button onClick={toggleFollow} disabled={fBusy} className={`${btn} ${follow ? "border border-gold text-gold bg-bgSurface" : "bg-gold text-bgPrimary"}`}>
              {follow ? "Отписаться" : "＋ Подписаться"}
            </button>
            {extra.canWrite ? (
              <Link href={`/chats/${userId}`} className={`${btn} border border-gold/60 text-gold bg-bgSurface`}>✉ Написать</Link>
            ) : (
              <span className={`${btn} border border-muted/60 text-muted bg-bgSurface`}>Сообщения закрыты</span>
            )}
          </>
        )}
      </div>

      <div className="px-5 mt-4 grid grid-cols-3 text-center">
        <div>
          <p className="text-goldSoft text-lg font-bold">{fmt(extra.purchases)}</p>
          <p className="text-muted text-[11px]">Покупок</p>
        </div>
        <button onClick={() => setSheet("followers")}>
          <p className="text-goldSoft text-lg font-bold">{fmt(followers)}</p>
          <p className="text-muted text-[11px]">Подписчики</p>
        </button>
        <button onClick={() => (owner ? router.push("/my-follows") : setSheet("following"))}>
          <p className="text-goldSoft text-lg font-bold">{fmt(extra.following)}</p>
          <p className="text-muted text-[11px]">Подписки</p>
        </button>
      </div>

      {extra.socials.length > 0 && (
        <div className="px-5 mt-4 flex flex-wrap gap-2.5">
          {extra.socials.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow" aria-label={socialKind(u)} className="w-[44px] h-[44px] rounded-full bg-bgSurface border border-gold/30 flex items-center justify-center text-offwhite">
              <SocialIcon kind={socialKind(u)} />
            </a>
          ))}
        </div>
      )}

      {owner && d.notPublished && (
        <div className="mx-5 mt-4 rounded-xl border border-gold bg-gold/10 p-4">
          <p className="text-offwhite text-sm font-semibold">Магазин пока скрыт от зрителей</p>
          <p className="text-muted text-xs mt-1">Заполните данные и выставьте товары, затем включите. Так магазин увидят все.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={enable} disabled={busy} className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">{busy ? "Включаем..." : "Включить магазин"}</button>
            <Link href="/business" className="flex-1 text-center border border-gold text-gold font-semibold rounded-full py-2.5 text-sm">Настройки</Link>
          </div>
          {msg && <p className="text-gold text-xs mt-2">{msg}</p>}
        </div>
      )}
      {owner && !d.notPublished && msg && <p className="mx-5 mt-3 text-gold text-xs">{msg}</p>}

      <BusinessPageView
        bare
        p={p}
        products={d.products}
        offers={d.offers}
        cur={d.cur}
        preview={owner}
        owner={owner}
        canOrder={!owner && !d.mine && !d.staff}
        demo={d.staff && !owner}
        onEdit={(pr) => setEdit(pr)}
      />

      {p.id && <ShopReportSheet open={reportOpen} onClose={() => setReportOpen(false)} businessId={p.id} />}
      {sheet && <FollowsSheet userId={userId} kind={sheet} onClose={() => setSheet(null)} />}
      {edit && (
        <ProductEditor
          cur={d.cur}
          userId={userId}
          product={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
            say("Сохранено");
          }}
        />
      )}
      {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-44 z-[140] bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">{toast}</div>}
    </div>
  );
}
