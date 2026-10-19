"use client";

import PresenceLine from "@/components/PresenceLine";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { SocialIcon, socialKind } from "@/lib/socialLinks";
import type { StatusTone } from "@/lib/status";
import Logo from "@/components/Logo";

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
  hideShare?: boolean;
  topRight: ReactNode;
  belowCrown?: ReactNode;
  verified?: boolean;
  /** Показать «в сети» / «был(а) недавно» для этого человека. */
  presenceUserId?: string;
  statusTone?: StatusTone;
  statusTalent?: boolean;
  badges?: { icon: string; label: string; hint: string }[];
  /** Плитки показателей (рейтинг, голоса, подарки) под цифрами подписчиков. */
  kpis?: HeroKpi[];
  /** Ряд кнопок под цифрами. Если задан, вместо старой кнопки «Поделиться». */
  actions?: ReactNode;
};

export type HeroKpi = { icon: ReactNode; value: string | number; label: string };

const kStroke = { fill: "none", stroke: "#E8D48A", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const KpiCrown = () => (
  <svg width="26" height="16" viewBox="0 0 100 60" fill="none">
    <path d="M10 50 L20 15 L35 35 L50 8 L65 35 L80 15 L90 50 Z" stroke="#E8D48A" strokeWidth="5" strokeLinejoin="round" />
  </svg>
);
export const KpiHeart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...kStroke}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
  </svg>
);
export const KpiGift = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...kStroke}>
    <rect x="3.5" y="9" width="17" height="11" rx="2" />
    <path d="M12 9v11M3.5 13h17M12 9c-2.5 0-4-1-4-2.4C8 5.4 9 5 10 5c1.6 0 2 2 2 4zm0 0c2.5 0 4-1 4-2.4C16 5.4 15 5 14 5c-1.6 0-2 2-2 4z" />
  </svg>
);

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
  hideShare = false,
  topRight,
  belowCrown,
  verified = false,
  presenceUserId,
  statusTone = "base",
  statusTalent = false,
  badges = [],
  kpis = [],
  actions,
}: Props) {
  const [badgesOpen, setBadgesOpen] = useState(false);
  const VerifiedMark = (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden className="flex-none">
              <path
                d="M12 1.8l2.6 1.9 3.2-.2 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.2L12 22.2l-2.6-1.9-3.2.2-1-3.1L2.6 15.5l1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.2z"
                fill="#E8D48A"
              />
              <path d="M8 12.2l2.8 2.8L16.2 9.6" fill="none" stroke="#1a1405" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
  );
  return (
    <div>
      <div className="relative overflow-hidden" style={{ height: "min(640px, 150vw)", minHeight: 520 }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex justify-center"
            style={{
              paddingTop: 110,
              background: "linear-gradient(170deg,#4b2a8f 0%,#b0306f 48%,#d98a2b 100%)",
            }}
          >
            <svg viewBox="0 0 200 250" aria-hidden style={{ width: "62%", maxWidth: 300, height: "auto" }}>
              <defs>
                <radialGradient id="pfSil" cx=".5" cy=".4" r=".6">
                  <stop offset="0" stopColor="#fff" stopOpacity=".35" />
                  <stop offset="1" stopColor="#fff" stopOpacity=".08" />
                </radialGradient>
              </defs>
              <g fill="url(#pfSil)" stroke="rgba(255,255,255,.35)" strokeWidth="1.5">
                <path d="M22 250 C22 180 60 150 100 150 C140 150 178 180 178 250 Z" />
                <circle cx="100" cy="82" r="36" />
              </g>
            </svg>
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
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-1.5">{topRight}</div>
        </div>
        {belowCrown && (
          <div
            className="absolute left-4 z-10"
            style={{ top: "calc(env(safe-area-inset-top) + 76px)" }}
          >
            {belowCrown}
          </div>
        )}

        <div className="absolute left-0 right-0 bottom-0 px-5 pb-2 z-10">
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] backdrop-blur ${
                statusTone === "win"
                  ? statusTalent
                    ? "border-transparent bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-bold"
                    : "border-transparent bg-gradient-to-r from-[#8a6d12] via-[#F5E6A8] to-[#8a6d12] text-[#1a1405] font-bold"
                  : statusTone === "fin"
                  ? "border-[#E8D48A] bg-[#C9A227]/30 text-white"
                  : statusTalent
                  ? "border-[#EC4899]/70 bg-black/35 text-[#f5b8d6]"
                  : "border-[#E8D48A]/55 bg-black/35 text-[#E8D48A]"
              }`}
            >
              {status}
            </span>
          )}
          <h1 className="mt-4 flex items-center gap-2.5 flex-wrap font-serif text-[34px] leading-[1.1] text-offwhite">
            <span>{name}</span>
            {verified && VerifiedMark}
          </h1>
          {presenceUserId && <PresenceLine userId={presenceUserId} className="mt-2" />}
          {handle && <p className="mt-3 text-[15px] text-[#c9c9ce]">{handle}</p>}
          {city && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E8D48A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              {city}
            </p>
          )}
          {rank && <p className="mt-1.5 text-[13px] text-[#E8D48A]">🏆 {rank}</p>}
          {badges.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {badges.slice(0, 3).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setBadgesOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-black/55 border border-muted/50 text-offwhite backdrop-blur"
                >
                  <span>{b.icon}</span>
                  {b.label}
                </button>
              ))}
              {badges.length > 3 && (
                <button type="button" onClick={() => setBadgesOpen(true)} className="text-xs px-3 py-1.5 rounded-full border border-muted/50 text-muted">
                  Все ›
                </button>
              )}
            </div>
          )}
          {bio && <p className="mt-5 text-[15px] leading-relaxed text-[#e6e6ea] whitespace-pre-line">{bio}</p>}
        </div>
      </div>

      {(socials.length > 0 || (!actions && !hideShare)) && (
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
          {!actions && !hideShare && (
            <button
              type="button"
              onClick={onShare}
              className={`rounded-full border border-muted/60 bg-bgSurface text-offwhite text-sm py-3 px-5 ${
                socials.length === 0 ? "flex-1" : "ml-auto"
              }`}
            >
              Поделиться
            </button>
          )}
        </div>
      )}

      {badgesOpen && (
        <div className="fixed inset-0 z-[70] bg-black/65 flex items-end justify-center" onClick={() => setBadgesOpen(false)}>
          <div
            className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-offwhite font-semibold">Достижения</p>
              <button onClick={() => setBadgesOpen(false)} className="text-muted text-xl" aria-label="Закрыть">✕</button>
            </div>
            {badges.map((b) => (
              <div key={b.label} className="flex items-center gap-3 py-2.5 border-t border-muted/40">
                <span className="w-10 h-10 rounded-full bg-bgPrimary flex items-center justify-center text-xl">{b.icon}</span>
                <span className="text-offwhite text-sm">
                  {b.label}
                  <span className="block text-muted text-xs">{b.hint} · считается каждую ночь</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div className="flex mx-5 mt-7 pt-6 border-t border-muted/25">
          {stats.map((s2, i) => (
            <button
              key={s2.label}
              type="button"
              onClick={s2.onClick}
              disabled={!s2.onClick}
              className={`flex-1 text-center ${i > 0 ? "border-l border-muted/40" : ""}`}
            >
              <span className="block text-[22px] font-semibold tabular-nums text-offwhite">{s2.value}</span>
              <span className="block mt-1 text-[12px] text-muted">{s2.label}</span>
            </button>
          ))}
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-3 px-5 pt-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-[#C9A227]/35 py-4 px-1 text-center"
              style={{ background: "linear-gradient(160deg,rgba(124,58,237,.18),rgba(11,11,13,.9))" }}
            >
              <div className="flex justify-center mb-2">{k.icon}</div>
              <b className="block text-[16px] tabular-nums text-[#E8D48A]">{k.value}</b>
              <span className="block mt-0.5 text-[10.5px] text-muted">{k.label}</span>
            </div>
          ))}
        </div>
      )}

      {actions && <div className="px-5 pt-6 pb-2 flex items-center gap-3">{actions}</div>}
    </div>
  );
}

// Ряд кнопок под цифрами профиля (обычный блок страницы, не плавающий).
export function IconSend() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 3 10.5 13.5" />
      <path d="M21.5 3 14.5 21l-4-7.5L3 9.5 21.5 3z" />
    </svg>
  );
}

export function ProfileActions({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 pt-6 pb-2">
      <div className="flex items-center gap-3">{children}</div>
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
