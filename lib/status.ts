// Статус участницы под фото: конкурс и этап (и звание победительницы).
export const CONTESTS: Record<string, { icon: string; name: string }> = {
  miss: { icon: "👑", name: "Miss" },
  talent: { icon: "🎭", name: "Talent" },
  brands: { icon: "🛍️", name: "Brands" },
  voice: { icon: "🎤", name: "Voice" },
  fame: { icon: "⭐", name: "Fame" },
  hunt: { icon: "🏃", name: "Hunt" },
};

export const STAGE_OPTIONS = [
  { key: "selection", label: "Отбор", title: "Участница" },
  { key: "r8", label: "1/8", title: "Участница" },
  { key: "r4", label: "1/4", title: "Четвертьфиналистка" },
  { key: "semi", label: "Полуфинал", title: "Полуфиналистка" },
  { key: "final", label: "Финал", title: "Финалистка" },
];

export const CROWN_OPTIONS = [
  { key: "", label: "Нет" },
  { key: "region", label: "Победительница региона" },
  { key: "season", label: "Победительница сезона" },
];

export type StatusTone = "base" | "fin" | "win";

export function statusFor(
  contest?: string | null,
  stage?: string | null,
  crown?: string | null,
  regionName?: string | null
): { text: string; tone: StatusTone; talent: boolean } {
  const c = CONTESTS[contest ?? "miss"] ?? CONTESTS.miss;
  const talent = (contest ?? "miss") === "talent";
  if (crown === "region") {
    return {
      text: `${c.icon} ${talent ? "Талант региона" : "Мисс региона"}${regionName ? ` · ${regionName}` : ""}`,
      tone: "win",
      talent,
    };
  }
  if (crown === "season") {
    return { text: `${c.icon} ${talent ? "Талант VETOKS" : "Мисс VETOKS"}`, tone: "win", talent };
  }
  const s = STAGE_OPTIONS.find((x) => x.key === stage) ?? STAGE_OPTIONS[0];
  return { text: `${c.icon} ${s.title} · ${c.name}`, tone: s.key === "final" ? "fin" : "base", talent };
}
