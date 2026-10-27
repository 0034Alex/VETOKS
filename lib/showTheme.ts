// Тема шоу: цвета приложения берутся из переменных --c-*, активное шоу подменяет их.
export type ShowTheme = {
  gold?: string;
  goldSoft?: string;
  sec?: string;
  sec2?: string;
  bg?: string;
  surface?: string;
};

export const THEME_KEYS: { key: keyof ShowTheme; label: string; def: string }[] = [
  { key: "gold", label: "Главный акцент (металл)", def: "#C9A227" },
  { key: "goldSoft", label: "Светлый акцент", def: "#E8D48A" },
  { key: "sec", label: "Второй цвет", def: "#7C3AED" },
  { key: "sec2", label: "Третий цвет", def: "#EC4899" },
  { key: "bg", label: "Фон", def: "#0B0B0D" },
  { key: "surface", label: "Карточки", def: "#161618" },
];

export const THEME_PRESETS: Record<string, { label: string; theme: ShowTheme }> = {
  miss: { label: "Miss: золото", theme: {} },
  plat: {
    label: "Платина и сапфир",
    theme: { gold: "#B7C4DA", goldSoft: "#E6EDF8", sec: "#3558E0", sec2: "#7B93FF", bg: "#0A0B0F", surface: "#15171D" },
  },
  rose: {
    label: "Розовое золото и бордо",
    theme: { gold: "#C98A7C", goldSoft: "#F2CFC3", sec: "#8E2B58", sec2: "#D6567F", bg: "#0D0A0B", surface: "#181315" },
  },
};

const VARS: Record<keyof ShowTheme, string> = {
  gold: "--c-gold",
  goldSoft: "--c-goldSoft",
  sec: "--c-sec",
  sec2: "--c-sec2",
  bg: "--c-bg",
  surface: "--c-surface",
};

function rgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function applyTheme(theme: ShowTheme | null | undefined) {
  const root = document.documentElement;
  (Object.keys(VARS) as (keyof ShowTheme)[]).forEach((k) => {
    const v = theme?.[k] ? rgb(String(theme[k])) : null;
    if (v) root.style.setProperty(VARS[k], v);
    else root.style.removeProperty(VARS[k]);
  });
}
