"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openSession, postJson } from "@/lib/authClient";

const KEY = "vt_tg_login_token";

// Кнопка «Войти через Telegram» для обычного браузера: открывает бота,
// человек нажимает Start, а страница сама это замечает и впускает.
export default function TelegramLoginButton({
  label = "Войти через Telegram",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "waiting" | "error" | "nobot">("idle");
  const [link, setLink] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  function poll(token: string) {
    stop();
    setState("waiting");
    let tries = 0;
    timer.current = setInterval(async () => {
      tries++;
      if (tries > 150) {
        stop();
        setState("error");
        try { localStorage.removeItem(KEY); } catch {}
        return;
      }
      const r = await postJson("/api/auth/tg-poll", { token });
      if (r.status === "ok") {
        stop();
        try { localStorage.removeItem(KEY); } catch {}
        if (await openSession(r.token_hash)) {
          router.replace("/");
          router.refresh();
        } else setState("error");
      } else if (r.status === "new") {
        stop();
        router.replace(`/register?tg=${token}`);
      } else if (r.status === "expired") {
        stop();
        setState("error");
        try { localStorage.removeItem(KEY); } catch {}
      }
    }, 2000);
  }

  // Если человек вернулся из Telegram и страница перезагрузилась —
  // продолжаем ждать с того же места.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) poll(saved);
    } catch {}
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setState("waiting");
    let countryId = "";
    try { countryId = localStorage.getItem("vt_country") || ""; } catch {}
    const r = await postJson("/api/auth/tg-start", { countryId });
    if (r.status === "no_bot") {
      setState("nobot");
      return;
    }
    if (r.status !== "ok") {
      setState("error");
      return;
    }
    try { localStorage.setItem(KEY, r.token); } catch {}
    setLink(r.link);
    poll(r.token);
    window.location.href = r.link;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={start}
        disabled={state === "waiting"}
        className="w-full bg-bgSurface text-gold border border-gold rounded-full px-8 py-3 font-semibold disabled:opacity-60"
      >
        {state === "waiting" ? "Ждём подтверждения в Telegram..." : `✈️ ${label}`}
      </button>
      {state === "waiting" && link && (
        <a href={link} className="block text-gold underline text-xs mt-2">
          Telegram не открылся? Нажмите сюда
        </a>
      )}
      {state === "nobot" && (
        <p className="text-muted text-xs mt-2">Вход через Telegram для вашей страны пока недоступен. Войдите по номеру телефона и паролю.</p>
      )}
      {state === "error" && (
        <p className="text-danger text-xs mt-2">
          Не получилось. Нажмите кнопку ещё раз.
        </p>
      )}
    </div>
  );
}
