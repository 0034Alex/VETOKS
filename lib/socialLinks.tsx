import type { ReactNode } from "react";

// Соцсети в профиле: человек вставляет ссылку, а мы по адресу узнаём сеть
// и показываем её значок.
export type SocialKind =
  | "instagram"
  | "tiktok"
  | "telegram"
  | "youtube"
  | "facebook"
  | "vk"
  | "x"
  | "link";

export function socialKind(url: string): SocialKind {
  const u = url.toLowerCase();
  if (/instagram\.com/.test(u)) return "instagram";
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/(^|\/\/|\.)t\.me\/|telegram\./.test(u)) return "telegram";
  if (/youtube\.com|youtu\.be/.test(u)) return "youtube";
  if (/facebook\.com|fb\.com|fb\.me/.test(u)) return "facebook";
  if (/(^|\/\/|\.)vk\.com/.test(u)) return "vk";
  if (/twitter\.com|(^|\/\/|\.)x\.com/.test(u)) return "x";
  return "link";
}

// Приводит ссылку к виду https://... и отбрасывает мусор.
export function normalizeLink(raw: string): string | null {
  let v = raw.trim();
  if (!v || v.length > 300 || /\s/.test(v)) return null;
  if (/^(javascript|data|vbscript):/i.test(v)) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SocialIcon({ kind, size = 20 }: { kind: SocialKind; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", ...S };
  const icons: Record<SocialKind, ReactNode> = {
    instagram: (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="16.8" cy="7.2" r=".6" fill="currentColor" />
      </svg>
    ),
    tiktok: (
      <svg {...common}>
        <path d="M14 4v10.5a3.5 3.5 0 11-3.5-3.5" />
        <path d="M14 4c.4 2.4 2 4 4.5 4.2" />
      </svg>
    ),
    telegram: (
      <svg {...common}>
        <path d="M21 4L3 11l6 2.2L11 20l3-4.5 4.5 3.3z" />
        <path d="M9 13.2L21 4" />
      </svg>
    ),
    youtube: (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="4" />
        <path d="M10.5 9.5v5l4-2.5z" />
      </svg>
    ),
    facebook: (
      <svg {...common}>
        <path d="M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />
      </svg>
    ),
    vk: (
      <span style={{ fontSize: size * 0.55, fontWeight: 700, letterSpacing: "-0.02em" }}>VK</span>
    ),
    x: (
      <svg {...common}>
        <path d="M5 5l14 14M19 5L5 19" />
      </svg>
    ),
    link: (
      <svg {...common}>
        <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L11.5 6.8" />
        <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5" />
      </svg>
    ),
  };
  return <>{icons[kind]}</>;
}

export function GiftIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S}>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5V20h14v-7.5M12 8.5V20" />
      <path d="M12 8.5C10 8.5 7.5 7.8 7.5 6a2 2 0 013.5-1.3L12 8.5zM12 8.5c2 0 4.5-.7 4.5-2.5a2 2 0 00-3.5-1.3z" />
    </svg>
  );
}

export function parseLinks(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : [];
}
