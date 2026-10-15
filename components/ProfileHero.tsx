"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SocialIcon, socialKind } from "@/lib/socialLinks";

export function Crown({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" fill="none" aria-hidden>
      <defs>
        <linearGradient id="pfGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8D48A" />
          <stop offset="100%" stopColor="#C9A227" />
        </linearGradient>
      </defs>
      <path
        d="M10 50 L20 15 L35 35 L50 8 L65 35 L80 15 L90 50 Z"
        stroke="url(#pfGold)"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="50" cy="8" r="4" fill="url(#pfGold)" />
      <circle cx="20" cy="15" r="3" fill="url(#pfGold)" />
      <circle cx="80" cy="15" r="3" fill="url(#pfGold)" />
    </svg>
  );
}

// Круглая кнопка в верхней полосе поверх фото.
export function TopBtn({
  children,
  onClick,
  href,
  badge,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  badge?: number;
  label: string;
}) {
  const cls =
    "relative w-10 h-10 rounded-full flex items-center justify-center text-offwhite bg-black/35 backdrop-blur border border-white/10";
  const inner = (
    <>
      {children}
      {badge ? (
        <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </>
  );
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {inner}
    </button>
  );
}

export const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);
export const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z" />
    <path d="M10 21h4" />
  </svg>
);
export const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconDots = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </svg>
);

export type HeroStat = { value: string | number; label: string; onClick?: () => void };

type Props = {
  photoUrl?: string | null;
  name: string;
  status?: string | null;
  city?: string | null;
  rank?: string | null;
  bio?: string | null;
  handle?: string | null;
  socials: string[];
  stats: HeroStat[];
  onShare: () => void;
  topRight: ReactNode;
  belowCrown?: ReactNode;
  verified?: boolean;
};

// Верх профиля: большое фото на весь экран, текст поверх тёмного затухания,
// ниже ряд соцсетей и «Поделиться», затем цифры.
export default function ProfileHero({
  photoUrl,
  name,
  status,
  city,
  rank,
  bio,
  handle,
  socials,
  stats,
  onShare,
  topRight,
  belowCrown,
  verified = true,
}: Props) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div>
      <div className="relative overflow-hidden" style={{ height: "min(640px, 150vw)", minHeight: 520 }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex justify-center pt-36 font-serif text-white/20"
            style={{
              fontSize: 200,
              lineHeight: 1,
              background: "linear-gradient(170deg,#4b2a8f 0%,#b0306f 48%,#d98a2b 100%)",
            }}
          >
            {initial}
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,rgba(11,11,13,.55) 0%,rgba(11,11,13,0) 22%,rgba(11,11,13,0) 38%,rgba(11,11,13,.72) 62%,#0B0B0D 90%)",
          }}
        />

        <div
          className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
        >
          <Link href="/" aria-label="VETOKS" className="drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]">
            <Crown />
          </Link>
          <div className="flex items-center gap-1.5">{topRight}</div>
        </div>
        {belowCrown && (
          <div
            className="absolute left-4 z-10"
            style={{ top: "calc(env(safe-area-inset-top) + 62px)" }}
          >
            {belowCrown}
          </div>
        )}

        <div className="absolute left-0 right-0 bottom-0 px-5 pb-2 z-10">
          {status && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8D48A]/55 bg-black/35 backdrop-blur px-4 py-1.5 text-[13px] text-[#E8D48A]">
              {status}
            </span>
          )}
          <h1 className="mt-3 flex items-center gap-2.5 flex-wrap font-serif text-[34px] leading-[1.1] text-offwhite">
            <span>{name}</span>
            {verified && (
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden className="flex-none">
              <path
                d="M12 1.8l2.6 1.9 3.2-.2 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.2L12 22.2l-2.6-1.9-3.2.2-1-3.1L2.6 15.5l1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.2z"
                fill="#E8D48A"
              />
              <path d="M8 12.2l2.8 2.8L16.2 9.6" fill="none" stroke="#1a1405" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            )}
          </h1>
          {handle && <p className="mt-2 text-[15px] text-[#c9c9ce]">{handle}</p>}
          {city && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E8D48A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              {city}
            </p>
          )}
          {rank && <p className="mt-1.5 text-[13px] text-[#E8D48A]">🏆 {rank}</p>}
          {bio && <p className="mt-3.5 text-[15px] leading-relaxed text-[#e6e6ea] whitespace-pre-line">{bio}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-5 pt-4">
        {socials.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {socials.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={socialKind(u)}
                className="w-[46px] h-[46px] rounded-full bg-bgSurface border border-muted/60 flex items-center justify-center text-offwhite"
              >
                <SocialIcon kind={socialKind(u)} />
              </a>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onShare}
          className={`rounded-full border border-muted/60 bg-bgSurface text-offwhite text-sm py-3 px-5 ${
            socials.length === 0 ? "flex-1" : "ml-auto"
          }`}
        >
          Поделиться
        </button>
      </div>

      {stats.length > 0 && (
        <div className="flex px-5 pt-5">
          {stats.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              disabled={!s.onClick}
              className={`flex-1 text-left ${i > 0 ? "pl-4 border-l border-muted/40" : ""}`}
            >
              <span className="block text-[26px] font-medium tabular-nums text-offwhite">{s.value}</span>
              <span className="text-[13px] text-muted">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Нижняя панель действий над меню.
export function ProfileActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed left-0 right-0 z-40 px-4 pt-8 pb-3 pointer-events-none"
      style={{
        bottom: "calc(80px + max(0px, env(safe-area-inset-bottom) - 16px))",
        background: "linear-gradient(180deg,rgba(11,11,13,0),rgba(11,11,13,.92) 55%)",
      }}
    >
      <div className="max-w-md mx-auto flex items-center gap-2.5 pointer-events-auto">{children}</div>
    </div>
  );
}

export function BigBtn({
  children,
  onClick,
  href,
  variant = "gold",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "gold" | "on" | "vote";
  disabled?: boolean;
}) {
  const base =
    "h-[58px] rounded-full font-semibold flex items-center justify-center disabled:opacity-40 text-center";
  const v =
    variant === "gold"
      ? "flex-1 text-[17px] text-[#1a1405] bg-gradient-to-b from-[#F1DE98] via-[#C9A227] to-[#b08d1c] shadow-[0_10px_26px_rgba(201,162,39,.28)]"
      : variant === "on"
      ? "flex-1 text-[16px] text-[#E8D48A] bg-bgSurface border border-[#8a6d12]"
      : "px-5 text-[15px] text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-[0_10px_26px_rgba(124,58,237,.3)]";
  if (href)
    return (
      <Link href={href} className={`${base} ${v}`}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${v}`}>
      {children}
    </button>
  );
}

export function RoundBtn({
  children,
  onClick,
  href,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  label: string;
}) {
  const cls =
    "flex-none w-[58px] h-[58px] rounded-full border border-muted/60 bg-bgSurface text-[#E8D48A] flex items-center justify-center";
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

// Выезжающее справа окно (меню профиля).
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose}>
      <div
        className="absolute top-0 right-0 bottom-0 w-[88%] max-w-sm bg-bgSurface border-l border-muted/50 overflow-y-auto px-4 pb-10"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <b className="text-base text-offwhite">{title}</b>
          <button onClick={onClose} aria-label="Закрыть" className="text-2xl leading-none text-muted px-2">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export async function shareLink(url: string, title: string) {
  try {
    const nav: any = navigator;
    if (nav.share) {
      await nav.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "";
  }
}
