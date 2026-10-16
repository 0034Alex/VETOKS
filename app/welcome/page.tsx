"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";
import { getMyCountry } from "@/lib/myCountry";
import { loadScoped } from "@/lib/scopedSettings";

function useCountdown(targetAt: string | null) {
  const [left, setLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    done: boolean;
  } | null>(null);

  useEffect(() => {
    if (!targetAt) return;
    const target = new Date(targetAt).getTime();

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setLeft({ days, hours, minutes, seconds, done: false });
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetAt]);

  return left;
}

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [targetAt, setTargetAt] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [buttonText, setButtonText] = useState("Подать анкету");

  useEffect(() => {
    (async () => {
      const map = await loadScoped(
        [
          "welcome_countdown_enabled",
          "welcome_countdown_target_at",
          "welcome_countdown_title",
          "welcome_countdown_subtitle",
          "welcome_countdown_button_text",
        ],
        (await getMyCountry()).countryId
      );

      const isEnabled = map.welcome_countdown_enabled === "true";
      if (!isEnabled) {
        router.replace("/");
        return;
      }

      setEnabled(true);
      setTargetAt(map.welcome_countdown_target_at || null);
      setTitle(map.welcome_countdown_title || "Приём заявок открыт!");
      setSubtitle(
        map.welcome_countdown_subtitle ||
          "До старта первой недели конкурса осталось:"
      );
      setButtonText(map.welcome_countdown_button_text || "Подать анкету");
      setLoading(false);
    })();
  }, [router]);

  const left = useCountdown(targetAt);

  if (loading || !enabled) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted bg-bgPrimary">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-bgPrimary">
      <Logo size={48} />

      <h1 className="text-2xl font-semibold text-gold mt-6 mb-2">{title}</h1>
      {subtitle && (
        <p className="text-muted text-sm mb-6 max-w-sm">{subtitle}</p>
      )}

      {targetAt && left && !left.done && (
        <div className="flex items-center gap-3 mb-8">
          {[
            { value: left.days, label: "дн" },
            { value: left.hours, label: "ч" },
            { value: left.minutes, label: "мин" },
            { value: left.seconds, label: "сек" },
          ].map((unit) => (
            <div
              key={unit.label}
              className="bg-bgSurface border border-gold/40 rounded-xl px-3 py-2 min-w-[64px]"
            >
              <div className="text-2xl font-semibold text-offwhite">
                {String(unit.value).padStart(2, "0")}
              </div>
              <div className="text-muted text-[10px] uppercase">
                {unit.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {targetAt && left && left.done && (
        <p className="text-success text-sm mb-8">Старт уже совсем скоро!</p>
      )}

      <Link
        href="/apply"
        className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full"
      >
        {buttonText}
      </Link>

      <Link href="/" className="text-muted text-xs underline mt-6">
        Пропустить и перейти в приложение
      </Link>
    </main>
  );
}
