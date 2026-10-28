// Запуск = шоу в конкретной стране. Все даты считаются от старта запуска и от этапов,
// а не вводятся вручную. Чистые функции: работают и на сервере, и в CRM.

export type Stage = { name: string; days: number };
export type LaunchRow = {
  id: string;
  country_id: string;
  show_key: string;
  status: string; // draft | live | paused | finished
  start_date: string | null; // YYYY-MM-DD
  after_id: string | null;
  after_offset: number;
  stages: Stage[];
  tz: string;
  position: number;
};
export type ItemRow = {
  id: string;
  launch_id: string;
  kind: string; // block | tip | question | task
  block_key: string | null;
  title: string;
  body: string;
  enabled: boolean;
  stage: number;
  start_mode: string; // from | end | before
  start_n: number;
  dur_mode: string; // stage | days
  dur_n: number;
  sort: number;
};

export const BLOCKS: { key: string; label: string }[] = [
  { key: "apply", label: "Кнопка «Подать анкету»" },
  { key: "battle", label: "Батл" },
  { key: "top", label: "Топ-25" },
  { key: "poll", label: "Опрос зрителей" },
];
export const KIND_LABEL: Record<string, string> = { block: "Блок", tip: "Подсказка участникам", question: "Вопрос зрителям", task: "Задание" };
export const DEFAULT_STAGES: Stage[] = [
  { name: "Отбор", days: 14 },
  { name: "Голосование", days: 21 },
  { name: "Финал", days: 7 },
];

const DAY = 86400000;
export const dayIdx = (s: string): number => {
  const [y, m, d] = s.split("-").map(Number);
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / DAY);
};
export const idxToStr = (i: number): string => new Date(i * DAY).toISOString().slice(0, 10);
export const idxToShort = (i: number): string => {
  const s = idxToStr(i);
  return `${s.slice(8, 10)}.${s.slice(5, 7)}`;
};

// «Сегодня» в часовом поясе страны (полночь переключает день именно там).
export function todayIdx(tz: string, now: number = Date.now()): number {
  try {
    const s = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
    return dayIdx(s);
  } catch {
    return Math.floor(now / DAY);
  }
}

export const totalDays = (l: Pick<LaunchRow, "stages">): number => (l.stages ?? []).reduce((a, s) => a + Math.max(1, Math.floor(Number(s.days) || 1)), 0);

// День старта: своя дата или «после другого запуска + N дней».
export function startIdx(l: LaunchRow, all: LaunchRow[], depth = 0): number | null {
  if (l.after_id && depth < 10) {
    const p = all.find((x) => x.id === l.after_id);
    if (p) {
      const ps = startIdx(p, all, depth + 1);
      if (ps === null) return null;
      return ps + totalDays(p) + (Math.floor(Number(l.after_offset)) || 0);
    }
  }
  return l.start_date ? dayIdx(l.start_date) : null;
}
export const endIdx = (l: LaunchRow, all: LaunchRow[]): number | null => {
  const s = startIdx(l, all);
  return s === null ? null : s + totalDays(l) - 1;
};

export function stageRange(l: LaunchRow, S: number, i: number): [number, number] {
  let o = 0;
  for (let k = 0; k < i && k < l.stages.length; k++) o += Math.max(1, Math.floor(Number(l.stages[k].days) || 1));
  const d = Math.max(1, Math.floor(Number(l.stages[i]?.days) || 1));
  return [S + o, S + o + d - 1];
}

// Когда пункт действует (индексы дней, включительно).
export function itemRange(l: LaunchRow, S: number, it: ItemRow): [number, number] {
  const si = Math.min(Math.max(0, it.stage | 0), Math.max(0, l.stages.length - 1));
  const [a0, b0] = stageRange(l, S, si);
  const n = Math.max(0, Math.floor(Number(it.start_n)) || 0);
  let a: number;
  if (it.start_mode === "before") a = S - n;
  else if (it.start_mode === "end") a = Math.max(a0, b0 - n + 1);
  else a = Math.min(b0, a0 + n);
  const d = Math.max(1, Math.floor(Number(it.dur_n)) || 1);
  let b = it.dur_mode === "days" ? a + d - 1 : b0;
  if (it.start_mode !== "before" && b > b0) b = b0;
  return [a, b];
}

export type EffState = "draft" | "paused" | "finished" | "waiting" | "live";
export function effState(l: LaunchRow, all: LaunchRow[], today: number): { state: EffState; S: number | null; E: number | null } {
  const S = startIdx(l, all);
  const E = S === null ? null : S + totalDays(l) - 1;
  if (l.status === "draft") return { state: "draft", S, E };
  if (l.status === "paused") return { state: "paused", S, E };
  if (l.status === "finished") return { state: "finished", S, E };
  if (S === null || E === null) return { state: "draft", S, E };
  if (today < S) return { state: "waiting", S, E };
  if (today > E) return { state: "finished", S, E };
  return { state: "live", S, E };
}

export function activeItems(l: LaunchRow, items: ItemRow[], S: number, today: number): ItemRow[] {
  return items.filter((it) => {
    if (!it.enabled || it.launch_id !== l.id) return false;
    const [a, b] = itemRange(l, S, it);
    return today >= a && today <= b;
  });
}

export function stageAt(l: LaunchRow, S: number, today: number): { idx: number; name: string; day: number } | null {
  for (let i = 0; i < l.stages.length; i++) {
    const [a, b] = stageRange(l, S, i);
    if (today >= a && today <= b) return { idx: i, name: l.stages[i].name, day: today - S + 1 };
  }
  return null;
}

export function defaultItems(): Omit<ItemRow, "id" | "launch_id">[] {
  const base = { kind: "block", title: "", body: "", enabled: true, start_mode: "from", start_n: 0, dur_mode: "stage", dur_n: 1 };
  return [
    { ...base, block_key: "apply", stage: 0, sort: 0 },
    { ...base, block_key: "battle", stage: 1, sort: 1 },
    { ...base, block_key: "top", stage: 0, dur_mode: "days", dur_n: 14 + 21 + 7, sort: 2 },
    { ...base, block_key: "poll", stage: 1, sort: 3 },
  ];
}
