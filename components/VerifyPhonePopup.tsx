"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getInitData, postJson } from "@/lib/authClient";

const HIDE_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/admin"];
const DISMISS_KEY = "vt_verify_dismissed";

// Окно «Подтвердите номер в Telegram». Показывается при входе, пока номер
// не подтверждён. Любое место приложения может открыть его событием:
// window.dispatchEvent(new Event("vetoks:verify-phone"))
export default function VerifyPhonePopup() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"login" | "action">("login");
  const [state, setState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const check = useCallback(async (): Promise<{ loggedIn: boolean; verified: boolean }> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { loggedIn: false, verified: false };
    const r = await postJson("/api/verify/status", {}, token);
    return { loggedIn: true, verified: !!r.verified };
  }, []);

  // При заходе — показать, если номер не подтверждён (один раз за открытие).
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    (async () => {
      let dismissed = false;
      try { dismissed = sessionStorage.getItem(DISMISS_KEY) === "1"; } catch {}
      if (dismissed) return;
      const s = await check();
      if (cancelled) return;
      if (s.loggedIn && !s.verified) {
        setReason("login");
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [hidden, check]);

  // Открытие по требованию (например, при нажатии «Проголосовать»).
  useEffect(() => {
    async function onRequest() {
      const s = await check();
      if (s.loggedIn && !s.verified) {
        setReason("action");
        setState("idle");
        setOpen(true);
      }
    }
    window.addEventListener("vetoks:verify-phone", onRequest);
    return () => window.removeEventListener("vetoks:verify-phone", onRequest);
  }, [check]);

  useEffect(() => stop, []);

  function dismiss() {
    stop();
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setOpen(false);
    setState("idle");
  }

  function poll() {
    stop();
    setState("waiting");
    let tries = 0;
    timer.current = setInterval(async () => {
      tries++;
      const s = await check();
      if (s.verified) {
        stop();
        setState("done");
        window.dispatchEvent(new Event("vetoks:verified"));
        setTimeout(() => setOpen(false), 1500);
      } else if (tries > 90) {
        stop();
        setState("error");
        setMsg("Не дождались подтверждения. Попробуйте ещё раз.");
      }
    }, 2000);
  }

  async function start() {
    setMsg("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const tg = (window as any).Telegram?.WebApp;
    const initData = getInitData();
    const r = await postJson("/api/verify/start", { initData }, token);

    if (r.status === "verified") {
      setState("done");
      setTimeout(() => setOpen(false), 800);
      return;
    }
    if (r.status !== "ok") {
      setState("error");
      setMsg("Не получилось начать. Попробуйте ещё раз.");
      return;
    }
    setLink(r.link);

    if (initData && tg?.requestContact) {
      // Внутри Telegram — родное окно «Поделиться номером».
      setState("waiting");
      tg.requestContact((sent: boolean) => {
        if (sent) poll();
        else {
          setState("idle");
          setMsg("Номер не отправлен. Нажмите «Подтвердить» и разрешите поделиться номером.");
        }
      });
      return;
    }

    // В обычном браузере (или старом Telegram) — через бота.
    poll();
    if (initData && tg?.openTelegramLink) tg.openTelegramLink(r.link);
    else window.location.href = r.link;
  }

  if (!open || hidden) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[100] bg-black/70 flex items-center justify-center px-4"
      style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm bg-bgSurface border border-gold rounded-2xl p-5 text-center overflow-y-auto"
        style={{ maxHeight: "85dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Закрыть"
          className="absolute top-2 right-3 text-muted text-2xl leading-none w-9 h-9"
        >
          ✕
        </button>
        {state === "done" ? (
          <>
            <p className="text-3xl mb-2">✅</p>
            <p className="text-offwhite font-semibold">Номер подтверждён!</p>
          </>
        ) : (
          <>
            <h2 className="text-gold text-lg font-semibold mb-2 pr-6">
              Подтвердите номер в Telegram
            </h2>
            <p className="text-offwhite text-sm mb-1">
              {reason === "action"
                ? "Чтобы голосовать, нужно подтвердить номер телефона."
                : "Подтвердите номер, чтобы получить 3 бесплатных голоса и пользоваться всеми возможностями."}
            </p>
            <p className="text-muted text-xs mb-4">
              Это бесплатно и занимает несколько секунд. Один номер — один аккаунт.
            </p>

            <button
              onClick={start}
              disabled={state === "waiting"}
              className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-3 disabled:opacity-60"
            >
              {state === "waiting" ? "Ждём подтверждения..." : "📱 Подтвердить в Telegram"}
            </button>

            {state === "waiting" && link && (
              <a href={link} className="block text-gold underline text-xs mt-2">
                Telegram не открылся? Нажмите сюда
              </a>
            )}
            {msg && <p className="text-danger text-xs mt-2">{msg}</p>}

            <button onClick={dismiss} className="text-muted text-xs underline mt-4">
              Позже
            </button>
          </>
        )}
      </div>
    </div>
  );
}
