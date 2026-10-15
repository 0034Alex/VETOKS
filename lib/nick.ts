// Правила красивого ника (одинаковые на сервере и в браузере).
export const NICK_MIN = 3;
export const NICK_MAX = 20;
export const NICK_COOLDOWN_DAYS = 30;

// Слова, которые нельзя использовать, чтобы никто не выдавал себя за команду.
const BLOCKED = [
  "vetoks", "vetok", "admin", "administrator", "support", "moderator", "official",
  "staff", "system", "root", "help", "owner", "manager", "team", "bot", "null", "undefined",
];

export function cleanNick(raw: unknown): string {
  return String(raw ?? "").trim().replace(/^@/, "").toLowerCase();
}

// Возвращает код ошибки или null, если ник подходит по правилам.
export function nickProblem(n: string): "length" | "format" | "reserved" | null {
  if (n.length < NICK_MIN || n.length > NICK_MAX) return "length";
  if (!/^[a-z][a-z0-9_]*$/.test(n)) return "format";
  if (n.endsWith("_") || n.includes("__")) return "format";
  if (BLOCKED.some((b) => n.includes(b))) return "reserved";
  return null;
}

export const NICK_MESSAGES: Record<string, string> = {
  length: "Ник должен быть от 3 до 20 символов.",
  format: "Только латинские буквы, цифры и подчёркивание. Начинается с буквы, без двойного подчёркивания и без подчёркивания в конце.",
  reserved: "Такой ник нельзя: в нём служебное слово.",
  taken: "Этот ник уже занят. Придумайте другой.",
  cooldown: "Ник можно менять раз в 30 дней.",
  error: "Не получилось сохранить. Попробуйте ещё раз.",
};
