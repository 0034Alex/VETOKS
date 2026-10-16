// Языки приложения и какие из них доступны в какой стране.
export type Lang = "ru" | "uk" | "en" | "ro" | "ka" | "az" | "kk" | "hy" | "uz" | "pl" | "cs" | "ky" | "tg" | "tk" | "be";

export const LANG_LABELS: Record<Lang, string> = {
  ru: "Русский",
  uk: "Українська",
  en: "English",
  ro: "Română",
  ka: "ქართული",
  az: "Azərbaycanca",
  kk: "Қазақша",
  hy: "Հայերեն",
  uz: "Oʻzbekcha",
  pl: "Polski",
  cs: "Čeština",
  ky: "Кыргызча",
  tg: "Тоҷикӣ",
  tk: "Türkmençe",
  be: "Беларуская",
};

export const ALL_LANGS = Object.keys(LANG_LABELS) as Lang[];

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (ALL_LANGS as string[]).includes(x);
}

// Первый язык в списке — основной для страны.
export const COUNTRY_LANGS: Record<string, Lang[]> = {
  UA: ["uk", "en", "ru"],
  MD: ["ro", "en", "ru"],
  GE: ["ka", "en", "ru"],
  AZ: ["az", "en", "ru"],
  KZ: ["kk", "en", "ru"],
  AM: ["hy", "en", "ru"],
  UZ: ["uz", "en", "ru"],
  PL: ["pl", "en"],
  RO: ["ro", "en"],
  CZ: ["cs", "en"],
  KG: ["ky", "en", "ru"],
  TJ: ["tg", "en", "ru"],
  TM: ["tk", "en", "ru"],
  BY: ["be", "en", "ru"],
  RU: ["ru", "en"],
};

export const DEFAULT_LANGS: Lang[] = ["ru", "uk", "en"];

export function langsForCountry(code?: string | null): Lang[] {
  const c = (code ?? "").toUpperCase();
  return COUNTRY_LANGS[c] ?? DEFAULT_LANGS;
}

// Код языка в Google Translate.
export const GOOGLE_CODE: Record<Lang, string> = {
  ru: "ru", uk: "uk", en: "en", ro: "ro", ka: "ka", az: "az", kk: "kk", hy: "hy",
  uz: "uz", pl: "pl", cs: "cs", ky: "ky", tg: "tg", tk: "tk", be: "be",
};
