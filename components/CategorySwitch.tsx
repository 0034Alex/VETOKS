"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/ageCategory";
import { useViewCategory, viewInfo, type ViewCat } from "@/lib/viewCategory";

// Золотая медаль в правом верхнем углу главного баннера.
// Нажали — три «лепестка» разлетаются дугой вниз-влево. Ставится внутрь контейнера с position: relative.
export default function CategorySwitch() {
  const { view, mine, setView, ready, canAll, teenHidden } = useViewCategory();
  const [open, setOpen] = useState(false);
  if (!ready) return null;
  const pos: Record<ViewCat, [number, number]> = { teen: [-122, 14], main: [-72, 70], adult: [-8, 106], all: [-132, 78] };
  const items: { key: ViewCat; label: string; ages: string }[] = CATEGORIES.filter((c) => !(c.key === "teen" && teenHidden));
  if (canAll) items.push({ key: "all", label: "ВСЕ", ages: "все" });
  const cur = viewInfo(view);
  const other = view !== mine;

  // После закрытия «будим» прокрутку: на iOS Safari и в Telegram она иногда залипает.
  function close() {
    setOpen(false);
    try {
      const y = window.scrollY;
      window.scrollTo(0, y + 1);
      window.scrollTo(0, y);
    } catch {
      /* не критично */
    }
  }

  return (
    <>
      {open && (
        <div aria-hidden onClick={close} className="fixed inset-0 z-40 bg-bgPrimary/60" />
      )}
      <div className="absolute z-50" style={{ top: 12, right: 36, width: 54, height: 54 }}>
        {open &&
          items.map((c, idx) => {
            const [x, y] = pos[c.key];
            const on = c.key === view;
            const locked = false;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  if (locked) return;
                  setView(c.key);
                  close();
                }}
                className={`absolute flex flex-col items-center justify-center rounded-full border-2 leading-none ${
                  on ? "border-gold bg-[#2a2412] text-gold" : "border-[#3a3a3e] bg-bgSurface text-offwhite"
                } ${locked ? "opacity-50" : ""}`}
                style={{
                  left: 0,
                  top: 0,
                  width: 54,
                  height: 54,
                  touchAction: "manipulation",
                  ["--x" as any]: `${x}px`,
                  ["--y" as any]: `${y}px`,
                  animation: `vetoksCatPetal .35s cubic-bezier(.3,1.5,.5,1) ${idx * 40}ms both`,
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
          onClick={() => (open ? close() : setOpen(true))}
          className="absolute inset-0 flex flex-col items-center justify-center rounded-full leading-none text-offwhite"
          style={{
            border: `2px ${other ? "dashed" : "solid"} rgb(var(--c-gold))`,
            background: "radial-gradient(circle at 30% 25%, #3a2f10, #161618 70%)",
            boxShadow: "0 0 0 4px rgba(201,162,39,.12), 0 6px 18px rgba(0,0,0,.5)",
            animation: open ? "none" : "vetoksCatGlow 2.4s ease-out infinite",
            zIndex: 5,
            touchAction: "manipulation",
          }}
        >
          <b className="text-[11px] font-extrabold tracking-wide">{cur.label}</b>
          <small className="text-[8px] mt-0.5 text-goldSoft font-semibold">{cur.ages}</small>
        </button>
        <style>{`@keyframes vetoksCatGlow{0%{box-shadow:0 0 0 0 rgba(201,162,39,.55),0 6px 18px rgba(0,0,0,.5)}70%{box-shadow:0 0 0 12px rgba(201,162,39,0),0 6px 18px rgba(0,0,0,.5)}100%{box-shadow:0 0 0 0 rgba(201,162,39,0),0 6px 18px rgba(0,0,0,.5)}}@keyframes vetoksCatPetal{from{transform:translate(0,0) scale(.3);opacity:0}to{transform:translate(var(--x),var(--y)) scale(1);opacity:1}}`}</style>
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
