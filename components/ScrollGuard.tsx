"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Страховка от «залипшей» прокрутки (iOS Safari, PWA, Telegram): иногда после
// перехода страница и боковое меню перестают скроллиться, пока не нажмёшь ещё
// раз. Здесь мы на каждом переходе, при возврате в приложение и при первом
// касании снимаем всё, что могло заблокировать прокрутку, и «будим» её.
// В приложении ничего не блокирует прокрутку специально, поэтому это безопасно.
function unlock() {
  try {
    for (const el of [document.documentElement, document.body]) {
      const s = el.style;
      if (s.overflow === "hidden" || s.overflowY === "hidden") {
        s.overflow = "";
        s.overflowY = "";
      }
      if (s.position === "fixed") {
        s.position = "";
        s.top = "";
        s.width = "";
      }
      if (s.touchAction === "none") s.touchAction = "";
      if (s.height && s.height !== "auto") s.height = "";
    }
    document.body.classList.remove("overflow-hidden");
    document.documentElement.classList.remove("overflow-hidden");
  } catch {}
}

function nudge() {
  unlock();
  try {
    // Крошечный сдвиг заставляет iOS заново принять прокрутку.
    const y = window.scrollY;
    window.scrollTo(0, y + 1);
    window.scrollTo(0, y);
  } catch {}
}

// Telegram Mini App: без expand() окно открывается «шторкой», а вертикальный
// жест Telegram забирает себе (хочет свернуть окно) — отсюда «не скроллится».
// Говорим Telegram: приложение готово, раскрой на весь экран и не перехватывай
// вертикальные свайпы. Повторяем после сворачивания/разворачивания.
function tgSetup() {
  try {
    const wa = (window as any).Telegram?.WebApp;
    if (!wa) return;
    wa.ready?.();
    wa.expand?.();
    if (wa.isVersionAtLeast?.("7.7")) wa.disableVerticalSwipes?.();
  } catch {}
}

export default function ScrollGuard() {
  const pathname = usePathname();

  useEffect(() => {
    unlock();
    const t1 = setTimeout(nudge, 50);
    const t2 = setTimeout(nudge, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  useEffect(() => {
    tgSetup();
    const wa = (window as any).Telegram?.WebApp;
    const onTg = () => {
      tgSetup();
      nudge();
    };
    try {
      wa?.onEvent?.("activated", onTg);
      wa?.onEvent?.("viewportChanged", onTg);
    } catch {}
    // Страница вернулась из «быстрой памяти» браузера (кнопка «назад») — могла прийти пустой
    const onPageShow = (e: any) => {
      if (e?.persisted && location.pathname.startsWith("/region-clan")) location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    const onShow = () => {
      tgSetup();
      nudge();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") onShow();
    };
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      try {
        wa?.offEvent?.("activated", onTg);
        wa?.offEvent?.("viewportChanged", onTg);
      } catch {}
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  return null;
}
