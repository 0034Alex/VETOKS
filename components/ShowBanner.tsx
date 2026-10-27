"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActiveShow } from "@/lib/useShow";

function left(to: number, now: number) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, over: s <= 0 };
}
const p2 = (n: number) => String(n).padStart(2, "0");

// Главный баннер шоу: картинка и тексты задаются в CRM → «Шоу», внизу обратный отсчёт и «Подать анкету».
export default function ShowBanner({ show }: { show: NonNullable<ActiveShow> }) {
  const bn = show.banner ?? {};
  const to = bn.countdown_to ? new Date(bn.countdown_to).getTime() : show.endsAt ? new Date(show.endsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!to) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [to]);
  const t = to ? left(to, now) : null;

  return (
    <div
      className="mx-6 rounded-2xl overflow-hidden relative border border-gold/30 min-h-[230px] flex flex-col justify-end p-5"
      style={{
        background: bn.image
          ? `linear-gradient(180deg, rgb(var(--c-bg) / 0.15), rgb(var(--c-bg) / 0.92)), url(${bn.image}) center/cover`
          : "radial-gradient(120% 90% at 85% 0%, rgb(var(--c-sec) / 0.5), transparent 60%), radial-gradient(90% 70% at 0% 100%, rgb(var(--c-gold) / 0.18), transparent 70%), linear-gradient(160deg, rgb(var(--c-surface)), rgb(var(--c-bg)))",
      }}
    >
      {bn.stage_label && <p className="text-goldSoft text-xs tracking-widest mb-1">{bn.stage_label.toUpperCase()}</p>}
      <h1 className="text-3xl font-bold text-offwhite leading-tight">{bn.title || show.title}</h1>
      {bn.subtitle && <p className="text-offwhite/80 text-xs mt-1">{bn.subtitle}</p>}

      {t && (
        <div className="mt-4 bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 backdrop-blur-sm">
          <p className="text-muted text-[10px] tracking-widest mb-1">{t.over ? "ЭТАП ЗАВЕРШЁН" : "ДО КОНЦА ЭТАПА"}</p>
          {!t.over && (
            <div className="flex gap-2 tabular-nums">
              {[[t.d, "дн"], [p2(t.h), "ч"], [p2(t.m), "мин"], [p2(t.s), "сек"]].map(([v, l]) => (
                <div key={String(l)} className="flex-1 text-center">
                  <p className="text-gold text-xl font-bold leading-none">{v}</p>
                  <p className="text-muted text-[10px] mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {bn.apply !== false && (
        <Link href="/apply" className="mt-3 text-center bg-gold text-bgPrimary rounded-full py-3 font-semibold text-sm">
          Подать анкету
        </Link>
      )}
    </div>
  );
}
