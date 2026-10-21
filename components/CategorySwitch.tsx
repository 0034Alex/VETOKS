"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/ageCategory";
import { useViewCategory, viewInfo, type ViewCat } from "@/lib/viewCategory";

// Полукруг, «свисающий» с верха экрана по центру шапки. Нажали — раскрывается веер из трёх категорий.
export default function CategorySwitch() {
  const { view, mine, setView, ready, canAll } = useViewCategory();
  const [open, setOpen] = useState(false);
  const [teenOpen, setTeenOpen] = useState(false);

  useEffect(() => {
    fetch("/api/categories/open")
      .then((r) => r.json())
      .then((d) => setTeenOpen(!!d?.teen_open))
      .catch(() => {});
  }, []);

  if (!ready) return null;
  const pos: Record<ViewCat, [number, number]> = { teen: [-78, 60], main: [0, 80], adult: [78, 60], all: [0, 150] };
  const items: { key: ViewCat; label: string; ages: string }[] = [...CATEGORIES];
  if (canAll) items.push({ key: "all", label: "ВСЕ", ages: "все" });
  const cur = viewInfo(view);
  const other = view !== mine;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Закрыть"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-bgPrimary/60"
        />
      )}
      <div
        className="absolute z-50"
        style={{ left: "50%", top: "env(safe-area-inset-top)", width: 68, marginLeft: -34 }}
      >
        {items.map((c) => {
          const [x, y] = pos[c.key];
          const on = c.key === view;
          const locked = c.key === "teen" && !teenOpen && mine !== "teen" && !canAll;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                if (locked) return;
                setView(c.key);
                setOpen(false);
              }}
              className={`absolute flex flex-col items-center justify-center rounded-full border-2 leading-none ${
                on ? "border-gold bg-gold/15 text-gold" : "border-[#3a3a3e] bg-bgSurface text-offwhite"
              }`}
              style={{
                left: 5,
                top: 2,
                width: 58,
                height: 58,
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transform: open ? `translate(${x}px, ${y}px) scale(1)` : "translate(0,0) scale(0.4)",
                transition: "transform .32s cubic-bezier(.3,1.4,.5,1), opacity .2s",
              }}
            >
              <b className="text-[11px] font-extrabold">{c.label}</b>
              <small className="text-[8px] mt-0.5 text-muted font-semibold">{locked ? "🔒 скоро" : c.ages}</small>
              {c.key === mine && (
                <i className="absolute -bottom-2 not-italic text-[8px] font-extrabold text-bgPrimary bg-gold rounded-md px-1.5 py-px">
                  ТВОЯ
                </i>
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Категория"
          onClick={() => setOpen((v) => !v)}
          className="relative flex flex-col items-center justify-center bg-bgSurface text-offwhite leading-none"
          style={{
            width: 68,
            height: 30,
            borderRadius: "0 0 34px 34px",
            border: "2px solid #C9A227",
            borderTop: 0,
            borderStyle: other ? "dashed" : "solid",
            zIndex: 3,
          }}
        >
          <b className="text-[11px] font-extrabold">{cur.label}</b>
          <small className="text-[8px] text-goldSoft font-semibold">{cur.ages}</small>
        </button>
      </div>
    </>
  );
}

// Тонкая полоска под шапкой, когда смотрим не свою категорию.
export function CategoryStrip() {
  const { view, mine, setView, ready } = useViewCategory();
  if (!ready || view === mine) return null;
  return (
    <div className="mx-6 mb-3 flex items-center justify-between gap-2 rounded-xl border border-gold/30 bg-gold/10 py-1.5 pl-3 pr-1.5 text-xs text-goldSoft">
      <span>Вы смотрите категорию {viewInfo(view).label}</span>
      <button
        type="button"
        onClick={() => setView(mine)}
        className="min-h-[36px] whitespace-nowrap rounded-full bg-gold px-3 text-xs font-bold text-bgPrimary"
      >
        ← В мою: {viewInfo(mine).label}
      </button>
    </div>
  );
}
