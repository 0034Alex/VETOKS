"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

export default function InvitesPage() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login?redirect=/invites");
        return;
      }
      setD(await apiPost("/api/referral/my", {}));
    })();
  }, [router]);

  if (!d) return <main className="min-h-screen flex items-center justify-center text-muted">Загрузка...</main>;

  const link = typeof window !== "undefined" ? `${window.location.origin}/r/${d.code}` : "";
  const text = "Присоединяйся к VETOKS — голосуй за участниц конкурса!";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  function share() {
    if (navigator.share) navigator.share({ title: "VETOKS", text, url: link }).catch(() => {});
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, "_blank");
  }

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
              <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
                <p className="text-muted text-xs mb-2">Ваша ссылка</p>
                <p className="text-offwhite text-sm break-all mb-3">{link}</p>
                <div className="flex gap-2">
                  <button onClick={copy} className="flex-1 border border-gold text-gold font-semibold py-2 rounded-full text-sm">
                    {copied ? "Скопировано ✓" : "Скопировать"}
                  </button>
                  <button onClick={share} className="flex-1 bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm">
                    Поделиться
                  </button>
                </div>
                <p className="text-muted text-[11px] mt-3">
                  Друг считается приглашённым, когда зарегистрируется по вашей ссылке и подтвердит номер в Telegram.
                  {d.rewardReferrer > 0 ? ` За каждого вы получите ${Math.round(d.rewardReferrer)} ₴.` : ""}
                  {d.rewardInvited > 0 ? ` Друг получит ${Math.round(d.rewardInvited)} ₴.` : ""}
                </p>
              </div>

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
                  <p className="text-gold text-xl font-semibold">{Math.round(d.earned)} ₴</p>
                  <p className="text-muted text-[11px]">Заработано</p>
                </div>
              </div>

              {d.list.length > 0 && (
                <div className="bg-bgSurface border border-muted rounded-xl divide-y divide-muted">
                  {d.list.map((x: any, i: number) => (
                    <div key={i} className="p-3 flex justify-between text-sm">
                      <span className="text-offwhite">{x.name}</span>
                      <span className={x.status === "qualified" ? "text-success" : "text-muted"}>
                        {x.status === "qualified" ? "засчитан" : "ждём подтверждения номера"}
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
