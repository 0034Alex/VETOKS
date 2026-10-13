"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  created_at: string;
  sender_name: string;
  participant_id: string;
  participant_name: string;
  kind: "gift" | "boost" | "card" | "donate";
  label: string;
  amount: number;
};

const ICON: Record<string, string> = { gift: "🎁", boost: "🚀", card: "🃏", donate: "💝" };

// «Живая Фан-Зона» — бегущая строка: все дорогие подарки и покупки идут подряд по кругу.
// Лёгкая: опрос раз в 8 сек (пауза, когда вкладка скрыта), движение — чистый CSS.
export default function FanZoneStrip() {
  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/fanzone", { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        setEnabled(j.enabled !== false);
        setItems(j.items ?? []);
      } catch {}
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (!enabled) return null;

  // Чтобы лента не «обрывалась» при малом числе событий, повторяем набор до нужной длины.
  const base = items;
  const reps = base.length === 0 ? 0 : Math.max(2, Math.ceil(10 / base.length));
  const chain: Item[] = [];
  for (let i = 0; i < reps; i++) chain.push(...base);
  const duration = Math.max(20, base.length * reps * 3.2);

  const one = (it: Item, key: string) => (
    <Link
      key={key}
      href={`/participant/${it.participant_id}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-offwhite px-4"
    >
      <span>{ICON[it.kind] ?? "🎁"}</span>
      <b>{it.sender_name}</b>
      <span className="text-[#EC4899]">→</span>
      <b>{it.participant_name}</b>
      <span className="text-goldSoft">· {it.label}</span>
      <span className="text-muted pl-3">✦</span>
    </Link>
  );

  return (
    <div className="px-6 mb-4">
      <style>{`
        @keyframes fzRun { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .fz-track { display:flex; width:max-content; animation: fzRun var(--fz-dur) linear infinite; }
        .fz-wrap:active .fz-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .fz-track { animation: none; } }
      `}</style>
      <div className="rounded-2xl border border-muted bg-bgSurface overflow-hidden flex items-center">
        <span className="text-xs font-semibold whitespace-nowrap text-[#EC4899] pl-3 pr-2 py-2.5 z-10 bg-bgSurface">
          <span className="inline-block w-2 h-2 rounded-full bg-[#EC4899] mr-1 animate-pulse" />
          Живая Фан-Зона
        </span>
        <div
          className="fz-wrap flex-1 min-w-0 overflow-hidden"
          style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}
        >
          {chain.length === 0 ? (
            <span className="text-offwhite text-sm px-3 whitespace-nowrap">Пока тихо — станьте первыми!</span>
          ) : (
            <div className="fz-track" style={{ ["--fz-dur" as any]: `${duration}s` }}>
              <div className="flex">{chain.map((it, i) => one(it, `a${i}`))}</div>
              <div className="flex" aria-hidden="true">{chain.map((it, i) => one(it, `b${i}`))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
