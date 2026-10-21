"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/ageCategory";
import { useViewCategory, viewInfo, type ViewCat } from "@/lib/viewCategory";

// Золотая медаль в правом верхнем углу главного баннера.
// Нажали — три «лепестка» разлетаются дугой вниз-влево. Ставится внутрь контейнера с position: relative.
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
  const pos: Record<ViewCat, [number, number]> = { teen: [-122, 14], main: [-72, 70], adult: [-8, 106], all: [-132, 78] };
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
      <div className="absolute z-50" style={{ top: 12, right: 36, width: 54, height: 54 }}>
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
                on ? "border-gold bg-[#2a2412] text-gold" : "border-[#3a3a3e] bg-bgSurface text-offwhite"
              } ${locked ? "opacity-50" : ""}`}
              style={{
                left: 0,
                top: 0,
                width: 54,
                height: 54,
                opacity: open ? (locked ? 0.5 : 1) : 0,
                pointerEvents: open ? "auto" : "none",
                transform: open ? `translate(${x}px, ${y}px) scale(1)` : "translate(0,0) scale(0.3)",
                transition: "transform .35s cubic-bezier(.3,1.5,.5,1), opacity .2s",
              }}
            >
              <b className="text-[11px] font-extrabold">{c.label}</b>
              <small className="text-[8px] mt-0.5 text-muted font-semibold">{locked ? "🔒" : c.ages}</small>
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
          className="absolute inset-0 flex flex-col items-center justify-center rounded-full leading-none text-offwhite"
          style={{
            border: `2px ${other ? "dashed" : "solid"} #C9A227`,
            background: "radial-gradient(circle at 30% 25%, #3a2f10, #161618 70%)",
            boxShadow: "0 0 0 4px rgba(201,162,39,.12), 0 6px 18px rgba(0,0,0,.5)",
            zIndex: 5,
          }}
        >
          <span
            aria-hidden
            className="absolute rounded-full border border-gold/40 pointer-events-none"
            style={{ inset: -9, animation: "vetoksCatPulse 2.4s ease-out infinite" }}
          />
          <b className="text-[11px] font-extrabold tracking-wide">{cur.label}</b>
          <small className="text-[8px] mt-0.5 text-goldSoft font-semibold">{cur.ages}</small>
        </button>
        <style>{`@keyframes vetoksCatPulse{from{transform:scale(.85);opacity:.9}to{transform:scale(1.25);opacity:0}}`}</style>
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
