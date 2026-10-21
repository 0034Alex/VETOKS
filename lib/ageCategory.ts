// Возрастные категории: TEEN 15–17, MISS 18–29, LADY 30+.
// Файл общий: им пользуются и страницы, и серверные маршруты.
export type AgeCategory = "teen" | "main" | "adult";

export const CATEGORIES: { key: AgeCategory; label: string; ages: string; title: string }[] = [
  { key: "teen", label: "TEEN", ages: "15–17", title: "VETOKS MISS TEEN" },
  { key: "main", label: "MISS", ages: "18–29", title: "VETOKS MISS" },
  { key: "adult", label: "LADY", ages: "30+", title: "VETOKS MISS LADY" },
];

export const MIN_AGE = 15;

export function categoryInfo(k: string | null | undefined) {
  return CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[1];
}

// «ГГГГ-ММ-ДД» → дата, либо null, если дата невозможна или не из этого века.
export function parseBirth(s: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900) return null;
  return dt;
}

export function ageOn(birth: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const before =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (before) age -= 1;
  return age;
}

export function categoryOfAge(age: number): AgeCategory | null {
  if (age < MIN_AGE || age > 110) return null;
  if (age < 18) return "teen";
  if (age < 30) return "main";
  return "adult";
}

export type BirthCheck =
  | { ok: true; birth: string; age: number; category: AgeCategory }
  | { ok: false; error: "invalid" | "too_young" | "too_old"; message: string };

export function checkBirth(s: unknown): BirthCheck {
  const dt = parseBirth(s);
  if (!dt || dt.getTime() > Date.now()) return { ok: false, error: "invalid", message: "Проверьте дату рождения." };
  const age = ageOn(dt);
  if (age > 110) return { ok: false, error: "too_old", message: "Проверьте дату рождения." };
  const category = categoryOfAge(age);
  if (!category) return { ok: false, error: "too_young", message: `Сервис доступен с ${MIN_AGE} лет.` };
  return { ok: true, birth: String(s), age, category };
}
