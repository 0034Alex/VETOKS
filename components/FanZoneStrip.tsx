"use client";

import { useEffect, useRef, useState } from "react";
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

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

// «Живая Фан-Зона» — бегущая строка самых дорогих подарков и покупок. Лёгкая: опрос раз в 6 сек, пауза когда вкладка скрыта.
export default function FanZoneStrip() {
  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const topId = useRef<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/fanzone", { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        setEnabled(j.enabled !== false);
        const list: Item[] = j.items ?? [];
        if (list.length && topId.current && list[0].id !== topId.current) {
          setIdx(0);
          setFresh(true);
          setTimeout(() => setFresh(false), 2500);
        }
        topId.current = list[0]?.id ?? null;
        setItems(list);
      } catch {}
    }
    load();
    const t = setInterval(load, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (items.length < 2 || open) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 3800);
    return () => clearInterval(t);
  }, [items.length, open]);

  if (!enabled) return null;

  const line = (it: Item) => (
    <>
      {ICON[it.kind] ?? "🎁"} <b>{it.sender_name}</b> → <b>{it.participant_name}</b> · {it.label}
    </>
  );

  return (
    <div className="px-6 mb-4">
      <div
        className={`rounded-2xl border ${fresh ? "border-[#EC4899]" : "border-muted"} bg-bgSurface overflow-hidden transition-colors`}
      >
        <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
          <span className="text-xs font-semibold whitespace-nowrap text-[#EC4899]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#EC4899] mr-1 animate-pulse" />
            Живая Фан-Зона
          </span>
          <span className="text-offwhite text-sm truncate flex-1" key={items[idx]?.id ?? "none"}>
            {items.length ? line(items[Math.min(idx, items.length - 1)]) : "Пока тихо — станьте первыми!"}
          </span>
          <span className="text-muted text-xs">{open ? "▴" : "▾"}</span>
        </button>
        {open && items.length > 0 && (
          <div className="border-t border-muted px-3 py-2 flex flex-col gap-2 max-h-64 overflow-y-auto">
            {items.map((it) => (
              <Link
                key={it.id}
                href={`/participant/${it.participant_id}`}
                className="flex items-center justify-between gap-2 text-sm text-offwhite"
              >
                <span className="truncate">{line(it)}</span>
                <span className="text-muted text-xs whitespace-nowrap">{ago(it.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
