"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

// Меню рисуется на каждой странице заново, поэтому прошлую позицию помним здесь:
// так золотая подсветка «скользит» от старого раздела к новому.
let lastIndex: number | null = null;

const items = [
  { href: "/", label: "nav.home", id: "home" },
  { href: "/participants", label: "nav.participants", id: "people" },
  { href: "/media", label: "nav.media", id: "media" },
  { href: "/shop", label: "nav.shop", id: "gift" },
  { href: "/rating", label: "nav.rating", id: "rating" },
  { href: "/profile", label: "nav.profile", id: "profile" },
];

function Icon({ id }: { id: string }) {
  switch (id) {
    case "home":
      return (
        <svg viewBox="0 0 24 24">
          <path className="roof" d="M3 11 L12 3 L21 11" />
          <path d="M5 10v10h14V10" />
          <rect className="win" x="10" y="13" width="4" height="7" rx="1" />
        </svg>
      );
    case "people":
      return (
        <svg viewBox="0 0 24 24">
          <circle className="h1" cx="9" cy="8" r="3.2" />
          <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
          <circle className="h2" cx="17" cy="9" r="2.4" />
          <path d="M16.5 14.2c2.8.2 4.5 2.4 4.5 5.3" />
        </svg>
      );
    case "media":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <circle className="ring" cx="12" cy="12" r="9" />
          <path className="tri fl" d="M10 8.5v7l6-3.5z" />
        </svg>
      );
    case "gift":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="11" width="16" height="9" rx="1.5" />
          <path d="M12 11v9" />
          <g className="lid">
            <rect x="3" y="7.5" width="18" height="3.5" rx="1" />
          </g>
          <g className="bow">
            <path d="M12 7.5C9 7.5 8 4 10 4s2 3.5 2 3.5zM12 7.5c3 0 4-3.5 2-3.5s-2 3.5-2 3.5z" />
          </g>
        </svg>
      );
    case "rating":
      return (
        <svg viewBox="0 0 24 24">
          <rect className="b1" x="4" y="13" width="4" height="7" rx="1" />
          <rect className="b2" x="10" y="5" width="4" height="15" rx="1" />
          <rect className="b3" x="16" y="9" width="4" height="11" rx="1" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24">
          <circle className="head" cx="12" cy="8" r="3.6" />
          <path className="wave" d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
        </svg>
      );
  }
}

const CSS = `
.vn{position:relative}
.vn-ind{position:absolute;top:6px;left:0;width:calc(100%/6);height:48px;display:flex;justify-content:center;pointer-events:none;transition:transform .45s cubic-bezier(.3,1.3,.5,1)}
.vn-ind i{display:block;width:54px;height:48px;border-radius:18px;background:radial-gradient(80% 90% at 50% 20%,rgba(201,162,39,.30),rgba(201,162,39,.08));border:1px solid rgba(201,162,39,.35);box-shadow:0 0 18px rgba(201,162,39,.25)}
.vn-glow{position:absolute;top:-1px;left:0;width:calc(100%/6);height:2px;display:flex;justify-content:center;pointer-events:none;transition:transform .45s cubic-bezier(.3,1.3,.5,1)}
.vn-glow i{display:block;width:28px;height:2px;border-radius:2px;background:#E8D48A;box-shadow:0 0 10px #C9A227}
.vn-btn{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 0 4px;color:#8A8A8E}
.vn-btn.on{color:#E8D48A}
.vn-btn svg{width:26px;height:26px;overflow:visible;transition:transform .3s}
.vn-btn.on svg{transform:translateY(-1px)}
.vn-btn span{font-size:10px;line-height:1;max-height:0;opacity:0;overflow:hidden;transition:max-height .3s,opacity .3s;text-align:center}
.vn-btn.on span{max-height:12px;opacity:1}
.vn-btn svg *{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transform-box:fill-box;transform-origin:center}
.vn-btn svg .fl{fill:currentColor;stroke:none}
.vn-btn svg .b1,.vn-btn svg .b2,.vn-btn svg .b3{transform-origin:50% 100%}
.vn-btn svg .ring{opacity:0}
.vn-btn.go .roof{animation:vnhop .5s cubic-bezier(.3,1.6,.5,1)}
.vn-btn.go .win{animation:vnlit .7s ease-out}
.vn-btn.go .h1{animation:vnpop .5s cubic-bezier(.3,1.8,.5,1)}
.vn-btn.go .h2{animation:vnpop .5s .1s cubic-bezier(.3,1.8,.5,1) both}
.vn-btn.go .tri{animation:vnslide .55s cubic-bezier(.3,1.5,.5,1)}
.vn-btn.go .ring{animation:vnring .7s ease-out}
.vn-btn.go .lid{animation:vnlid .65s cubic-bezier(.3,1.6,.5,1)}
.vn-btn.go .bow{animation:vnwig .65s ease-in-out}
.vn-btn.go .b1{animation:vngrow .45s cubic-bezier(.3,1.5,.5,1)}
.vn-btn.go .b2{animation:vngrow .45s .08s cubic-bezier(.3,1.5,.5,1) both}
.vn-btn.go .b3{animation:vngrow .45s .16s cubic-bezier(.3,1.5,.5,1) both}
.vn-btn.go .head{animation:vnnod .7s ease-in-out}
.vn-btn.go .wave{animation:vnwave .7s ease-in-out}
@keyframes vnhop{0%{transform:translateY(0)}40%{transform:translateY(-4px) scale(1.06)}100%{transform:translateY(0)}}
@keyframes vnlit{0%{fill:transparent}30%{fill:#E8D48A}100%{fill:transparent}}
@keyframes vnpop{0%{transform:scale(1)}45%{transform:scale(1.35) translateY(-2px)}100%{transform:scale(1)}}
@keyframes vnslide{0%{transform:translateX(-5px);opacity:.3}60%{transform:translateX(2px);opacity:1}100%{transform:translateX(0)}}
@keyframes vnring{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.35);opacity:0}}
@keyframes vnlid{0%{transform:translateY(0) rotate(0)}45%{transform:translateY(-6px) rotate(-14deg)}100%{transform:translateY(0) rotate(0)}}
@keyframes vnwig{0%,100%{transform:rotate(0)}25%{transform:rotate(-16deg) scale(1.15)}60%{transform:rotate(12deg) scale(1.1)}}
@keyframes vngrow{0%{transform:scaleY(.3)}60%{transform:scaleY(1.2)}100%{transform:scaleY(1)}}
@keyframes vnnod{0%,100%{transform:translateY(0)}35%{transform:translateY(2px) scale(.94)}65%{transform:translateY(-3px) scale(1.08)}}
@keyframes vnwave{0%,100%{transform:rotate(0)}30%{transform:rotate(-8deg)}65%{transform:rotate(8deg)}}
@media (prefers-reduced-motion:reduce){.vn *{animation:none!important;transition:none!important}}
`;

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const active = items.findIndex((i) => i.href === pathname);
  // Стартуем со старой позиции, чтобы подсветка поехала к новой.
  const [pos, setPos] = useState<number>(lastIndex ?? active);
  const [go, setGo] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (active < 0) return;
    const changed = lastIndex !== null && lastIndex !== active;
    const id = requestAnimationFrame(() => setPos(active));
    if (changed || first.current) {
      setGo(true);
      const t1 = setTimeout(() => setGo(false), 900);
      first.current = false;
      lastIndex = active;
      return () => {
        cancelAnimationFrame(id);
        clearTimeout(t1);
      };
    }
    lastIndex = active;
    return () => cancelAnimationFrame(id);
  }, [active]);

  const shift = `translateX(${Math.max(pos, 0) * 100}%)`;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="bg-bgSurface border-t border-muted flex justify-center"
    >
      <style>{CSS}</style>
      <div className="vn w-full max-w-3xl flex items-stretch">
        {active >= 0 && (
          <>
            <div className="vn-glow" style={{ transform: shift }}>
              <i />
            </div>
            <div className="vn-ind" style={{ transform: shift }}>
              <i />
            </div>
          </>
        )}
        {items.map((item, i) => {
          const on = i === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (on) {
                  setGo(false);
                  requestAnimationFrame(() => {
                    setGo(true);
                    setTimeout(() => setGo(false), 900);
                  });
                }
              }}
              className={`vn-btn ${on ? "on" : ""} ${on && go ? "go" : ""}`}
            >
              <Icon id={item.id} />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
