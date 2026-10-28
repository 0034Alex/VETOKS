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

// Реестр блоков шаблона. Новый блок в приложении = новая строка здесь (с умолчаниями);
// кнопка «Опубликовать» в CRM добавит его во все запуски (не трогая то, что уже есть).
export type BlockDef = { key: string; label: string; stage: number; start_mode: string; start_n: number; dur_mode: string; dur_n: number; shows?: "miss" | "other" };
const W = { stage: -1, start_mode: "from", start_n: 0, dur_mode: "stage", dur_n: 1 };
export const BLOCKS: BlockDef[] = [
  { key: "apply", label: "Кнопка «Подать анкету»", stage: 0, start_mode: "from", start_n: 0, dur_mode: "stage", dur_n: 1 },
  { key: "battle", label: "Батл", ...W, shows: "other" },
  { key: "top", label: "Топ-25", ...W },
  { key: "poll", label: "Опрос зрителей", ...W },
  { key: "stories", label: "Истории", ...W, shows: "other" },
  { key: "promo", label: "Рекламные баннеры на главной", ...W },
  { key: "scope", label: "Переключатель «Мой регион / Вся страна»", ...W, shows: "miss" },
  { key: "cats", label: "Переключатель категорий Teen / 18–29 / 30+", ...W, shows: "miss" },
  { key: "news", label: "Объявления", ...W, shows: "miss" },
  { key: "strip", label: "Яркая полоса", ...W, shows: "miss" },
  { key: "mag", label: "Журнал", ...W, shows: "miss" },
  { key: "partners", label: "Партнёры (логотипы)", ...W, shows: "miss" },
  // Страница «Участницы»
  { key: "p_promo", label: "Участницы: рекламные баннеры вверху", ...W },
  { key: "p_cats", label: "Участницы: переключатель категорий", ...W, shows: "miss" },
  { key: "p_rating", label: "Участницы: вкладка «Рейтинг»", ...W },
  { key: "p_scope", label: "Участницы: «Мой регион / Вся страна»", ...W },
  { key: "p_search", label: "Участницы: поиск", ...W },
  { key: "p_filters", label: "Участницы: фильтры «Все / Топ / Новые»", ...W },
  { key: "p_blackmark", label: "Участницы: кнопка «Чёрная метка»", ...W },
  { key: "p_ticker", label: "Участницы: бегущая лента внизу", ...W },
];
// Какие блоки имеют смысл для шоу: у блока может быть пометка «только Мисс» или «только остальные шоу».
export const blockFits = (blockKey: string, showKey: string | null | undefined): boolean => {
  const d = BLOCKS.find((b) => b.key === blockKey);
  if (!d || !d.shows) return true;
  return d.shows === "miss" ? showKey === "miss" : showKey !== "miss";
};
// Подсказки, вопросы и задания по дням нужны только главной Таланта и подобных шоу.
export const extrasFit = (showKey: string | null | undefined): boolean => showKey !== "miss";
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
  let a0: number, b0: number;
  if ((it.stage | 0) < 0) {
    a0 = S;
    b0 = S + totalDays(l) - 1; // «весь запуск»
  } else {
    const si = Math.min(Math.max(0, it.stage | 0), Math.max(0, l.stages.length - 1));
    [a0, b0] = stageRange(l, S, si);
  }
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

// Сколько миллисекунд осталось до конца дня (полночь по часовому поясу страны).
export function msToMidnight(tz: string, now: number = Date.now()): number {
  try {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/Kyiv", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    return Math.max(0, DAY - ((g("hour") * 60 + g("minute")) * 60 + g("second")) * 1000);
  } catch {
    return DAY - (now % DAY);
  }
}

export function stageAt(l: LaunchRow, S: number, today: number): { idx: number; name: string; day: number; endIdx: number } | null {
  for (let i = 0; i < l.stages.length; i++) {
    const [a, b] = stageRange(l, S, i);
    if (today >= a && today <= b) return { idx: i, name: l.stages[i].name, day: today - S + 1, endIdx: b };
  }
  return null;
}

export function defaultItems(showKey?: string | null): Omit<ItemRow, "id" | "launch_id">[] {
  return BLOCKS.filter((b) => blockFits(b.key, showKey)).map((b, i) => ({ kind: "block", block_key: b.key, title: "", body: "", enabled: true, stage: b.stage, start_mode: b.start_mode, start_n: b.start_n, dur_mode: b.dur_mode, dur_n: b.dur_n, sort: i }));
}

// Часовой пояс по умолчанию для каждой страны (по нему в 00:00 страны меняется день запуска).
export const COUNTRY_TZ: Record<string, string> = {
  UA: "Europe/Kyiv", MD: "Europe/Chisinau", GE: "Asia/Tbilisi", AZ: "Asia/Baku", KZ: "Asia/Almaty",
  AM: "Asia/Yerevan", UZ: "Asia/Tashkent", PL: "Europe/Warsaw", RO: "Europe/Bucharest", CZ: "Europe/Prague",
  KG: "Asia/Bishkek", TJ: "Asia/Dushanbe", TM: "Asia/Ashgabat", BY: "Europe/Minsk", RU: "Europe/Moscow",
};
const TZ_NAME: Record<string, string> = {
  "Europe/Kyiv": "Киев", "Europe/Chisinau": "Кишинёв", "Asia/Tbilisi": "Тбилиси", "Asia/Baku": "Баку", "Asia/Almaty": "Алматы",
  "Asia/Yerevan": "Ереван", "Asia/Tashkent": "Ташкент", "Europe/Warsaw": "Варшава", "Europe/Bucharest": "Бухарест",
  "Europe/Prague": "Прага", "Asia/Bishkek": "Бишкек", "Asia/Dushanbe": "Душанбе", "Asia/Ashgabat": "Ашхабад",
  "Europe/Minsk": "Минск", "Europe/Moscow": "Москва",
};
export const TZ_LIST: string[] = Object.keys(TZ_NAME);
export function tzLabel(tz: string): string {
  let off = "";
  try {
    off = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName")?.value.replace("GMT", "UTC") ?? "";
  } catch {}
  return `${TZ_NAME[tz] ?? tz}${off ? ` (${off})` : ""}`;
}
