// Всё «сутки / неделя / воскресенье» в приложении считается по киевскому
// времени, а не по времени телефона или сервера.
const TZ = "Europe/Kiev";

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    year: +g("year"),
    month: +g("month"),
    day: +g("day"),
    hour: +g("hour"),
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday")), // 0=пн … 6=вс
  };
}

/** Дата по Киеву: YYYY-MM-DD */
export function kyivDate(d: Date = new Date()): string {
  const p = parts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function kyivIsSunday(d: Date = new Date()): boolean {
  return parts(d).weekday === 6;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Понедельник текущей недели по Киеву. */
export function kyivWeekStart(d: Date = new Date()): string {
  return addDays(kyivDate(d), -parts(d).weekday);
}

/** Момент (UTC), когда в Киеве наступила полночь указанной даты. */
export function kyivDayStartUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  for (const offset of [3, 2]) {
    const cand = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset * 3600000);
    if (kyivDate(cand) === dateStr && parts(cand).hour === 0) return cand;
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 3 * 3600000);
}

/** Сколько миллисекунд до ближайших 00:01 по Киеву. */
export function msToNextUpdate(now: Date = new Date()): number {
  const todayStart = kyivDayStartUtc(kyivDate(now)).getTime() + 60000;
  if (now.getTime() < todayStart) return todayStart - now.getTime();
  const tomorrowStart = kyivDayStartUtc(addDays(kyivDate(now), 1)).getTime() + 60000;
  return tomorrowStart - now.getTime();
}
