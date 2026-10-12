"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

const TOGGLES: [string, string][] = [
  ["gifts", "Подарки, донаты и покупки карточек"],
  ["tasks", "Задания: одобрение и награды"],
  ["support", "Ответы поддержки"],
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [verified, setVerified] = useState(false);
  const [tgLinked, setTgLinked] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/settings");
        return;
      }
      setUserId(u.id);
      setVerified(!!u.phone_verified);
      setPhone(u.phone);
      const { data } = await supabase.from("users").select("telegram_id, notify_tg").eq("id", u.id).maybeSingle();
      setTgLinked(!!data?.telegram_id);
      setPrefs((data?.notify_tg as Record<string, boolean>) ?? {});
      setLoading(false);
    })();
    const onVerified = () => setVerified(true);
    window.addEventListener("vetoks:verified", onVerified);
    return () => window.removeEventListener("vetoks:verified", onVerified);
  }, [router]);

  async function toggle(key: string) {
    const next = { ...prefs, [key]: prefs[key] === false };
    setPrefs(next);
    await supabase.from("users").update({ notify_tg: next }).eq("id", userId);
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center text-muted">Загрузка...</main>;

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto">
        <PageHeader />
        <div className="px-6 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-offwhite">Настройки</h1>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-2">Номер телефона</p>
            {verified ? (
              <p className="text-success text-sm">✓ Подтверждён{phone ? ` (${phone})` : ""}</p>
            ) : (
              <>
                <p className="text-muted text-xs mb-2">
                  Без подтверждения недоступны бесплатные голоса. Номер подтверждается через Telegram-бота.
                </p>
                <button
                  onClick={() => window.dispatchEvent(new Event("vetoks:verify-phone"))}
                  className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
                >
                  Подтвердить номер
                </button>
              </>
            )}
            <p className="text-muted text-[11px] mt-3">
              Номер нельзя изменить вручную — только повторным подтверждением через Telegram.
            </p>
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-1">Уведомления в Telegram</p>
            {tgLinked ? (
              <p className="text-muted text-xs mb-3">Важные события дублируются сообщением от бота.</p>
            ) : (
              <p className="text-muted text-xs mb-3">
                Telegram не привязан к аккаунту — сообщения от бота не придут, уведомления будут только в приложении.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {TOGGLES.map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-offwhite text-sm">
                  <span>{label}</span>
                  <input type="checkbox" checked={prefs[k] !== false} onChange={() => toggle(k)} />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-1">Язык</p>
            <p className="text-offwhite text-sm">Русский</p>
            <p className="text-muted text-xs mt-1">Украинский и английский появятся позже.</p>
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
