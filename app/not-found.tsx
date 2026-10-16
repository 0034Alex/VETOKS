"use client";

import { useEffect } from "react";
import Link from "next/link";

// Страница «не найдено». Внутри Telegram один раз сама возвращает на главную:
// так редкий сбой при входе не превращается в тупик.
export default function NotFound() {
  useEffect(() => {
    try {
      const inTg = !!(window as any).Telegram?.WebApp?.initData;
      const KEY = "vt_404_home_at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (inTg && Date.now() - last > 15000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.replace("/");
      }
    } catch {}
  }, []);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-gold text-5xl font-semibold mb-3">404</p>
      <p className="text-offwhite mb-1">Страница не найдена</p>
      <p className="text-muted text-sm mb-6">Возможно, ссылка устарела.</p>
      <Link href="/" className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full">
        На главную
      </Link>
    </main>
  );
}
