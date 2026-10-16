"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getInitData, postJson } from "@/lib/authClient";

const HIDE_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/admin"];
const AUTO_SHOWN_KEY = "vt_verify_auto_shown"; // окно «через сутки» уже показано
const DISMISS_AT_KEY = "vt_verify_dismiss_at"; // когда окно закрыли в последний раз
const DAY = 24 * 60 * 60 * 1000;

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch {}
}

// Окно «Подтвердите номер в Telegram».
// — Само появляется один раз: через сутки после регистрации.
// — Дальше только в момент действия (голос, подарок...) и не чаще раза в сутки;
//   если окно недавно закрывали, показываем короткую подсказку вместо него.
// Любое место приложения может открыть его событием:
// window.dispatchEvent(new Event("vetoks:verify-phone"))
export default function VerifyPhonePopup() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"login" | "action">("login");
  const [state, setState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  // Помним на сервере, а не в браузере: в PWA и Telegram локальная память
  // может сбрасываться, и окно появлялось бы заново при каждом входе.
  const mark = useCallback(async (kind: "auto" | "dismiss") => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await postJson("/api/verify/mark", { kind }, token);
    } catch {}
  }, []);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const check = useCallback(async (): Promise<{ loggedIn: boolean; verified: boolean; createdAt: string | null; promptAt: string | null; dismissAt: string | null }> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { loggedIn: false, verified: false, createdAt: null, promptAt: null, dismissAt: null };
    const r = await postJson("/api/verify/status", {}, token);
    return {
      loggedIn: true,
      verified: !!r.verified,
      createdAt: (r.createdAt as string) ?? null,
      promptAt: (r.promptAt as string) ?? null,
      dismissAt: (r.dismissAt as string) ?? null,
    };
  }, []);

  // Один раз: через сутки после регистрации.
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    (async () => {
      if (lsGet(AUTO_SHOWN_KEY) === "1") return;
      const s = await check();
      if (cancelled || !s.loggedIn || s.verified || !s.createdAt) return;
      if (s.promptAt) {
        lsSet(AUTO_SHOWN_KEY, "1");
        return;
      }
      if (Date.now() - new Date(s.createdAt).getTime() < DAY) return;
      lsSet(AUTO_SHOWN_KEY, "1");
      mark("auto");
      setReason("login");
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [hidden, check, mark]);

  // По требованию (нажали «Проголосовать» и т.п.). Если окно закрывали меньше
  // суток назад — вместо него короткая подсказка.
  useEffect(() => {
    async function onRequest() {
      const s = await check();
      if (s.loggedIn && !s.verified) {
        const serverLast = s.dismissAt ? new Date(s.dismissAt).getTime() : 0;
        const last = Math.max(Number(lsGet(DISMISS_AT_KEY) || 0), serverLast);
        if (last && Date.now() - last < DAY) {
          setToast(true);
          setTimeout(() => setToast(false), 4500);
          return;
        }
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
    lsSet(DISMISS_AT_KEY, String(Date.now()));
    mark("dismiss");
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

  if (toast && !open && !hidden) {
    return (
      <button
        onClick={() => {
          setToast(false);
          lsSet(DISMISS_AT_KEY, "0");
          mark("dismiss");
          setReason("action");
          setState("idle");
          setOpen(true);
        }}
        className="fixed left-4 right-4 z-[100] bg-bgSurface border border-gold text-offwhite text-sm rounded-xl px-4 py-3 text-left"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        Для этого нужно подтвердить номер. <span className="text-gold underline">Подтвердить</span>
      </button>
    );
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
