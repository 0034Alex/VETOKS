"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCurrencySymbol } from "@/lib/currency";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

const ERR: Record<string, string> = {
  already: "Приглашение уже привязано к вашему аккаунту.",
  too_old: "Код можно ввести только в первые 7 дней после регистрации.",
  bad_code: "Такого кода или ника нет. Проверьте и попробуйте ещё раз.",
  self: "Свой код вводить нельзя.",
  limit: "У этого человека сегодня закончился лимит приглашений. Попробуйте завтра.",
  other_country: "Этот человек из другой страны.",
  disabled: "Приглашения сейчас отключены.",
};

export default function InvitesPage() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [cur, setCur] = useState("₴");
  const [copied, setCopied] = useState<"" | "tg" | "web">("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

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

  async function copy(kind: "tg" | "web") {
    try {
      await navigator.clipboard.writeText(kind === "tg" ? tgLink : webLink);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch {}
  }
  function share() {
    const url = tgLink || webLink;
    if (navigator.share) navigator.share({ title: "VETOKS", text, url }).catch(() => {});
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
  }
  async function enterCode() {
    if (!code.trim() || sending) return;
    setSending(true);
    setMsg("");
    const r = await apiPost("/api/referral/claim", { code: code.trim() });
    setSending(false);
    if (r?.ok) {
      setMsg(r.referrerName ? `Готово! Вас пригласил: ${r.referrerName} 🎉` : "Готово! Приглашение принято 🎉");
      setCode("");
      load();
    } else {
      setMsg(ERR[r?.error as string] ?? "Не получилось. Попробуйте ещё раз.");
    }
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
                <p className="text-muted text-xs mb-2">Ваша ссылка в Telegram</p>
                <p className="text-offwhite text-sm break-all mb-3">{tgLink || webLink}</p>
                <div className="flex gap-2">
                  <button onClick={() => copy(tgLink ? "tg" : "web")} className="flex-1 border border-gold text-gold font-semibold py-2 rounded-full text-sm">
                    {copied ? "Скопировано ✓" : "Скопировать"}
                  </button>
                  <button onClick={share} className="flex-1 bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm">
                    Поделиться
                  </button>
                </div>
                {tgLink && (
                  <button onClick={() => copy("web")} className="mt-3 text-muted text-xs underline">
                    {copied === "web" ? "Ссылка скопирована ✓" : "Ссылка для сайта (не Telegram)"}
                  </button>
                )}
                <p className="text-muted text-[11px] mt-3">
                  Друг считается приглашённым, когда зарегистрируется по вашей ссылке и подтвердит номер в Telegram.
                  {d.rewardReferrer > 0 ? ` За каждого вы получите ${Math.round(d.rewardReferrer)} ${cur}.` : ""}
                  {d.rewardInvited > 0 ? ` Друг получит ${Math.round(d.rewardInvited)} ${cur}.` : ""}
                  {d.percent > 0 ? ` Плюс ${d.percent}% от его покупок в течение ${d.percentDays} дн. — бонус платит VETOKS, другу ничего не теряется.` : ""}
                </p>
              </div>

              {d.invitedBy && (
                <p className="text-muted text-sm">
                  Вас пригласил: <span className="text-offwhite">{d.invitedBy}</span>
                </p>
              )}

              {d.canEnterCode && (
                <div className="bg-bgSurface border border-muted rounded-xl p-4">
                  <p className="text-offwhite text-sm font-semibold mb-1">Вас пригласил друг?</p>
                  <p className="text-muted text-xs mb-3">Введите его ник или код — это можно сделать в первые 7 дней после регистрации.</p>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Ник или код друга"
                      maxLength={40}
                      className="flex-1 min-w-0 bg-bgPrimary border border-muted rounded-full px-4 py-2 text-sm text-offwhite"
                    />
                    <button
                      onClick={enterCode}
                      disabled={sending || !code.trim()}
                      className="bg-gold text-bgPrimary font-semibold px-4 rounded-full text-sm disabled:opacity-40"
                    >
                      {sending ? "..." : "Ввести"}
                    </button>
                  </div>
                  {msg && <p className="text-gold text-xs mt-2">{msg}</p>}
                </div>
              )}

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
