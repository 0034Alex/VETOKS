"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCurrencySymbol } from "@/lib/currency";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

// Карточка со ссылкой: копирование, «Поделиться» и QR-код.
function LinkCard({ title, link, shareText, note }: { title: string; link: string; shareText: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  function share() {
    if (navigator.share) navigator.share({ title: "VETOKS", text: shareText, url: link }).catch(() => {});
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`, "_blank");
  }
  async function toggleQr() {
    if (!showQr && !qr) {
      try {
        const mod: any = await import("qrcode");
        const QR = mod.default ?? mod;
        setQr(await QR.toDataURL(link, { margin: 1, width: 240 }));
      } catch {}
    }
    setShowQr((v) => !v);
  }
  return (
    <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
      <p className="text-muted text-xs mb-2">{title}</p>
      <p className="text-offwhite text-sm break-all mb-3">{link}</p>
      <div className="flex gap-2">
        <button onClick={copy} className="flex-1 border border-gold text-gold font-semibold py-2 rounded-full text-sm">
          {copied ? "Скопировано ✓" : "Скопировать"}
        </button>
        <button onClick={share} className="flex-1 bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm">
          Поделиться
        </button>
      </div>
      <button onClick={toggleQr} className="w-full mt-2 border border-muted text-offwhite py-2 rounded-full text-sm">
        {showQr ? "Скрыть QR-код" : "Показать QR-код"}
      </button>
      {showQr && qr && (
        <div className="flex justify-center mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR-код ссылки" width={240} height={240} className="rounded-lg bg-white p-2" />
        </div>
      )}
      {note && <p className="text-muted text-[11px] mt-3">{note}</p>}
    </div>
  );
}

export default function InvitesPage() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [cur, setCur] = useState("\uE000");

  async function load() {
    setD(await apiPost("/api/referral/my", {}));
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login?redirect=/invites");
        return;
      }
      setCur(await getCurrencySymbol());
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!d) return <LoadingScreen />;

  const who = d.nick || d.code;
  const webLink = typeof window !== "undefined" ? `${window.location.origin}/r/${who}` : "";
  const tgLink = d.bot ? `https://t.me/${d.bot}?start=ref_${who}` : "";
  const text = "Присоединяйся к VETOKS — голосуй за участниц конкурса!";
  const advText = "Реклама в VETOKS: приложение конкурса красоты. Регистрируйтесь и размещайте рекламу.";

  const advWebLink = webLink ? `${webLink}?a=1` : "";
  const advTgLink = d.bot ? `https://t.me/${d.bot}?start=adv_${who}` : "";

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto">
        <PageHeader />
        <div className="px-6 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-offwhite">Мои приглашения</h1>

          {!d.enabled ? (
            <p className="text-muted text-sm">Приглашения сейчас отключены.</p>
          ) : (
            <>
              <LinkCard
                title="Ваша ссылка для друзей"
                link={tgLink || webLink}
                shareText={text}
                note={
                  "Друг считается приглашённым, когда зарегистрируется по вашей ссылке и подтвердит номер в Telegram." +
                  (d.rewardReferrer > 0 ? ` За каждого вы получите ${Math.round(d.rewardReferrer)} ${cur}.` : "") +
                  (d.rewardInvited > 0 ? ` Друг получит ${Math.round(d.rewardInvited)} ${cur}.` : "") +
                  (d.percent > 0 ? ` Плюс ${d.percent}% от его покупок в течение ${d.percentDays} дн.` : "")
                }
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bgSurface border border-muted rounded-xl p-3 text-center">
                  <p className="text-gold text-xl font-semibold">{d.invited}</p>
                  <p className="text-muted text-[11px]">Пришло по ссылке</p>
                </div>
                <div className="bg-bgSurface border border-muted rounded-xl p-3 text-center">
                  <p className="text-gold text-xl font-semibold">{d.qualified}</p>
                  <p className="text-muted text-[11px]">Подтвердили номер</p>
                </div>
                <div className="bg-bgSurface border border-muted rounded-xl p-3 text-center">
                  <p className="text-gold text-xl font-semibold">{Math.round((d.earned + (d.commission ?? 0)) * 100) / 100} {cur}</p>
                  <p className="text-muted text-[11px]">Заработано</p>
                </div>
              </div>

              {d.canInviteAdvertisers && (
                <>
                  <LinkCard
                    title="Ссылка для рекламодателя"
                    link={advTgLink || advWebLink}
                    shareText={advText}
                    note="Отправьте владельцу бизнеса. Он зарегистрируется по этой ссылке, получит рекламный кабинет и будет закреплён за вами. Вы получите бонус один раз, с его первой оплаты рекламы."
                  />
                  {(d.advertisers?.length ?? 0) > 0 && (
                    <div className="bg-bgSurface border border-muted rounded-xl p-4">
                      <p className="text-offwhite text-sm font-semibold mb-2">Ваши рекламодатели</p>
                      {d.advertisers.map((a: any, i: number) => (
                        <p key={i} className="text-offwhite text-sm py-1 border-t border-muted/40 first:border-t-0">{a.name}</p>
                      ))}
                      {d.advEarned > 0 && <p className="text-gold text-xs mt-2">Бонусов получено: {Math.round(d.advEarned * 100) / 100} {cur}</p>}
                    </div>
                  )}
                </>
              )}

              {d.list.length > 0 && (
                <div className="bg-bgSurface border border-muted rounded-xl divide-y divide-muted">
                  {d.list.map((x: any, i: number) => (
                    <div key={i} className="p-3 flex justify-between text-sm">
                      <span className="text-offwhite">{x.name}</span>
                      <span className={x.status === "qualified" ? "text-success" : x.status === "rejected" ? "text-danger" : "text-muted"}>
                        {x.status === "qualified"
                          ? x.reward > 0
                            ? `засчитан · +${Math.round(x.reward)} ${cur}`
                            : "засчитан"
                          : x.status === "rejected"
                            ? "отклонён"
                            : "ждём подтверждения номера"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
