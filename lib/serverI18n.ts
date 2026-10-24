// Перевод готовых текстов на сервере (сообщения бота и т.п.) по тем же словарям,
// что и в приложении: public/i18n/{uk,en,ru}.json. Исходный текст — русский или украинский.
import uk from "@/public/i18n/uk.json";
import en from "@/public/i18n/en.json";
import ru from "@/public/i18n/ru.json";

type Dict = { exact: Map<string, string>; patterns: { re: RegExp; tpl: string }[] };
const norm = (s: string) => s.replace(/\{[a-zA-Z]+\}/g, "{}");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function build(raw: Record<string, string>): Dict {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; tpl: string }[] = [];
  for (const k of Object.keys(raw)) {
    const nk = norm(k).replace(/\s+/g, " ").trim();
    const v = norm(raw[k]);
    if (nk.includes("{}")) {
      const re = new RegExp("^" + nk.split("{}").map(esc).join("(.+?)") + "$");
      let i = 0;
      patterns.push({ re, tpl: v.replace(/\{\}/g, () => "$" + ++i) });
    } else exact.set(nk, v);
  }
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, patterns };
}

const DICTS: Record<string, Dict> = {
  uk: build(uk as Record<string, string>),
  en: build(en as Record<string, string>),
  ru: build(ru as Record<string, string>),
};
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;

// переводим подставленное значение (название подарка, города и т.п.), если оно есть в словаре
function part(d: Dict, v: string): string {
  const c = v.trim();
  if (!c || !CYR.test(c)) return v;
  const h = d.exact.get(c);
  return h != null ? h : v;
}

function line(d: Dict, text: string): string {
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  const core = text.trim().replace(/\s+/g, " ");
  if (!core || !CYR.test(core)) return text;
  const hit = d.exact.get(core);
  if (hit != null) return lead + hit + trail;
  for (const p of d.patterns) {
    const m = core.match(p.re);
    if (m) return lead + p.tpl.replace(/\$(\d+)/g, (_x, i) => part(d, m[Number(i)] ?? "")) + trail;
  }
  const tm = core.match(/^([\s\S]*?)([\s:.,;!?…]+)$/);
  if (tm && tm[1]) {
    const h2 = d.exact.get(tm[1]);
    if (h2 != null) return lead + h2 + tm[2] + trail;
  }
  return text;
}

/** Переводит текст на язык профиля: по строкам, что не нашлось в словаре — остаётся как есть. */
export function trServer(lang: string | null | undefined, text: string): string {
  const l = lang === "ru" || lang === "en" || lang === "uk" ? lang : "uk";
  const d = DICTS[l];
  const whole = line(d, text);
  if (whole !== text) return whole;
  return text.split("\n").map((x) => line(d, x)).join("\n");
}
