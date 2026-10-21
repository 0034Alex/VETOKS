"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useViewCategory } from "@/lib/viewCategory";

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
  const vc = useViewCategory();

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.hidden) return;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const r = await fetch(`/api/fanzone?cat=${vc.view}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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
  }, [vc.view]);

  if (!enabled) return null;

  // Чтобы лента не «обрывалась» при малом числе событий, повторяем набор до нужной длины.
  const base = items;
  const reps = base.length === 0 ? 0 : Math.max(2, Math.ceil(10 / base.length));
  const chain: Item[] = [];
  for (let i = 0; i < reps; i++) chain.push(...base);
  const duration = Math.max(20, base.length * reps * 3.2);

  const one = (it: Item, key: string) => (
    <span
      key={key}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-offwhite px-4 select-none"
    >
      <span>{ICON[it.kind] ?? "🎁"}</span>
      <b>{it.sender_name}</b>
      <span className="text-[#EC4899]">→</span>
      <b>{it.participant_name}</b>
      <span className="text-goldSoft">· {it.label}</span>
      <span className="text-muted pl-3">✦</span>
    </span>
  );

  return (
    <div className="px-6 mb-4">
      <style>{`
        @keyframes fzRun { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .fz-track { display:flex; width:max-content; animation: fzRun var(--fz-dur) linear infinite; }
                @media (prefers-reduced-motion: reduce) { .fz-track { animation: none; } }
      `}</style>
      <div className="rounded-2xl border border-muted bg-bgSurface overflow-hidden flex items-center">
        <div
          className="fz-wrap flex-1 min-w-0 overflow-hidden py-2.5 pointer-events-none"
          style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}
        >
          {chain.length === 0 ? (
            <span className="text-offwhite text-sm px-4 whitespace-nowrap">Пока тихо — станьте первыми!</span>
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
