"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { applyOpen, useBetween, useRecruit } from "@/lib/useShow";

const p2 = (n: number) => String(n).padStart(2, "0");

// Страна ещё не начала первое шоу: человек видит только отсчёт до старта (и «Подать анкету», если набор открыт).
export default function PreStartScreen() {
  const b = useBetween();
  const r = useRecruit();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const to = b?.prestart ?? 0;
  const s = Math.max(0, Math.floor((to - now) / 1000));
  // Старт наступил: просим приложение обновиться.
  useEffect(() => {
    if (to && now >= to) {
      const t = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(t);
    }
  }, [now, to]);
  const units: [number, string][] = [
    [Math.floor(s / 86400), "дн"],
    [Math.floor((s % 86400) / 3600), "ч"],
    [Math.floor((s % 3600) / 60), "мин"],
    [s % 60, "сек"],
  ];
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-bgPrimary">
      <Logo size={48} />
      <h1 className="text-2xl font-semibold text-gold mt-6 mb-2">Скоро старт!</h1>
      <p className="text-muted text-sm mb-6 max-w-sm">До старта шоу осталось:</p>
      <div className="flex items-center gap-3 mb-8">
        {units.map(([v, l]) => (
          <div key={l} className="bg-bgSurface border border-gold/40 rounded-xl px-3 py-2 min-w-[64px]">
            <div className="text-2xl font-semibold text-offwhite tabular-nums">{p2(v)}</div>
            <div className="text-muted text-[10px] uppercase">{l}</div>
          </div>
        ))}
      </div>
      {r && applyOpen(r.banner) && (
        <Link href="/apply" className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full">
          Подать анкету
        </Link>
      )}
    </main>
  );
}
