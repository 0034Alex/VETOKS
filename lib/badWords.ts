// Фильтр запрещённых слов (русский, украинский, английский).
// Ловит словоформы, приставки, подмену букв похожими (латиница, цифры, символы),
// растянутые буквы («хууууй»), точки/пробелы между буквами («х у й», «б.л.я»).
// Работает одинаково в браузере и на сервере. Проверка на сервере — главная.

// Похожие буквы → кириллица
const TO_CYR: Record<string, string> = {
  a: "а", b: "в", c: "с", e: "е", h: "н", k: "к", m: "м", o: "о", p: "р", t: "т", x: "х", y: "у", u: "и",
  "0": "о", "3": "з", "4": "ч", "6": "б", "@": "а", $: "с", "§": "с",
  ё: "е", й: "и", ъ: "", ь: "", ї: "и", і: "и", є: "е", ґ: "г",
};
// Похожие буквы → латиница (для английских слов)
const TO_LAT: Record<string, string> = {
  а: "a", в: "b", с: "c", е: "e", н: "h", к: "k", м: "m", о: "o", р: "p", т: "t", х: "x", у: "y", і: "i", ї: "i",
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "|": "i",
};

const ZERO = /[​-‏⁠﻿­̀-ͯ]/g;

function clean(s: string): string {
  return s.normalize("NFKD").replace(ZERO, "").toLowerCase();
}

function mapChars(s: string, map: Record<string, string>): string {
  let out = "";
  for (const ch of s) out += ch in map ? map[ch] : ch;
  return out;
}

function rawTokens(s: string): string[] {
  return s.split(/[^a-zа-яёіїєґ0-9@$§!|*]+/i).filter(Boolean);
}

// Слова: буквы и цифры/символы-«маски» внутри слова. Одиночные буквы через пробел/точку склеиваем в одно слово.
function tokens(s: string): string[] {
  const raw = rawTokens(s);
  const out: string[] = [];
  let run = "";
  for (const t of raw) {
    if (t.length === 1 && /[a-zа-яёіїєґ@$]/i.test(t)) {
      run += t;
    } else {
      if (run.length >= 3) out.push(run);
      run = "";
      out.push(t);
    }
  }
  if (run.length >= 3) out.push(run);
  return out;
}

function collapse(w: string): string {
  return w.replace(/(.)\1{2,}/g, "$1$1").replace(/(.)\1/g, "$1");
}

// Приставки, которые «приклеиваются» к матерным корням
const PRE = "(?:на|за|вы|от|до|по|при|раз|ра|с|у|об|под|пере|про|недо|не|ни|во|из|ис|в|о|а|и|ох|ах|пиздо|хуе|еб|взъ|объ|подъ|съ)?";

// Русские (после замены на кириллицу, й→и, ё→е, ъ/ь убраны, повторы схлопнуты)
const RU: RegExp[] = [
  new RegExp(`^${PRE}${PRE}ху[иеяю]`),            // хуй, хуя, хуё, нахуй, похуй, охуел
  /^(?:на|по|за|не)?хули$/,
  new RegExp(`^${PRE}${PRE}пизд`),                // пизда, пиздец, распиздяй
  new RegExp(`^${PRE}${PRE}(?:е|ё)б(?:а[нтлшц]|у[тнчщл]|и[тсшл]|н[уи]|л[оа]|ну|ы[вр]|ё|е[рнт]|ок)`),
  /^(?:за|вы|от|на|по|у|с|съ|раз|разъ|об|подъ|до)?еб(?:ись|ись|и|ать|ал|ан|ут|у|ло|ло|ля|ну|нул|ак|аки|ак|ан)$/,
  /^(?:а?ебан|ебуч|ебуч|ебыр|ебал|уеб|уебан|уебок|заеб|заебал|заебись|наеб|разеб|доеб|поеб|проеб|выеб|еблан|ебнут|ебанут|ебанат)/,
  /^бляд?[ьтискк]?/, /^бляд/, /^блят/, /^блять/, /^бляха/, /^блед[ии]?$/ ,
  /^(?:су[кч](?:а|и|у|е|ой|ам|ами|ах|ка|ки|ку|ке|кой|ар|ара|аре|ары|ий|ья|ьи|ье|ьи))$/,
  /^су(?:ч|к)[аи]р[аыуе]?$/,
  /^(?:муд[ао][кчхб]|мудил|мудозвон|мудень)/,
  /^(?:пид[оа]р|пидр|педик|педераст|пидорас|пидараст|гомик|гомосек)/,
  /^(?:гандон|гондон)/, /^залуп/, /^(?:шлюх|шалав)/, /^(?:дроч|дрочи)/,
  /^(?:мраз[ьи]|мразот|ублюд|выблядок|выродок)/,
  /^(?:долбо[её]б|долбаеб|дебил|дурак$)/,
  /^(?:срак|жопа$|жопу$|жопе$|говн|дерьм)/,
  /^(?:манда$|мандавошк|вагин|хер$|херн|хера$|херов)/,
  /^(?:проститут|проститук|шмара|курв|шлюшк|блядин)/,
  /^(?:порно|порнух|интимуслуг|эскорт|секс(?:услуг|ворк)|минет|сосу(?:ть)?$|отсос|трах(?:ну|ать|аю|нул|нем))/,
  /^(?:нигер|нигга|ниггер|чурк[аи]|черномаз|жидяр|жидовк|хохл[ыуе]?$|москал|кацап|ватник)/,
];

// Английские (после замены на латиницу)
const EN: RegExp[] = [
  /^f+u+c+k/, /^fck$/, /^fuk$/, /^phuck/, /^motherf/, /^wtf$/,
  /^sh[i1]t(?:s|ty|head|bag)?$/, /^bullsh/,
  /^b[i1]tch/, /^cunt/, /^d[i1]ck(?:s|head)?$/, /^pussy/, /^wh[o0]re/, /^sl[uv]t/,
  /^n[i1]gg/, /^f[a4]gg?[o0]t/, /^retard/, /^asshole/, /^arsehole/, /^bastard/,
  /^porn/, /^blowjob/, /^handjob/, /^cocksuck/, /^jerkoff/, /^masturbat/, /^escort/,
];

// Только для склеенного без пробелов текста — самые «тяжёлые» корни (минимум ложных срабатываний)
const STRONG_RU = ["хуи", "хуя", "хуе", "хую", "пизд", "ебат", "ебан", "ебал", "бляд", "блят", "блять", "бляь", "пидор", "пидар", "залуп", "гандон", "мудак", "мудил", "ебну", "ебен", "ебут"];
const STRONG_EN = ["fuck", "bitch", "cunt", "nigger", "whore", "pussy", "asshole"];

function hitWord(w: string): boolean {
  if (w.length < 2) return false;
  // «х*й», «б*ять»: звёздочка вместо буквы — пробуем гласные и согласные
  if (w.includes("*")) {
    if (w.replace(/\*/g, "").length < 1) return false;
    return ["у", "е", "и", "а", "о", "я", "л", "б", "u", "e", "i", "a", "o"].some((c) => hitWord(w.replace(/\*/g, c)));
  }
  const cyr = collapse(mapChars(w, TO_CYR));
  const cyr0 = mapChars(w, TO_CYR); // без схлопывания (для «хули» и коротких)
  if (RU.some((re) => re.test(cyr) || re.test(cyr0))) return true;
  const lat = collapse(mapChars(w, TO_LAT));
  const lat0 = mapChars(w, TO_LAT);
  if (EN.some((re) => re.test(lat) || re.test(lat0))) return true;
  return false;
}

// true — в тексте есть запрещённое
export function hasBadWords(input: string): boolean {
  const s = clean(String(input ?? ""));
  if (!s.trim()) return false;
  for (const w of tokens(s)) if (hitWord(w)) return true;
  // Слово разбито пробелами на части («пи зда», «ху й», «бл я т ь»): склеиваем до 5 соседних слов,
  // где все, кроме последнего, короткие, и ищем самые «тяжёлые» корни.
  const parts = rawTokens(s).filter((p) => !p.includes("*"));
  for (let i = 0; i < parts.length - 1; i++) {
    let joined = parts[i];
    for (let j = i + 1; j < parts.length && j < i + 5; j++) {
      if (parts[j - 1].length > 3) break;
      joined += parts[j];
      const cyr = collapse(mapChars(joined, TO_CYR));
      if (STRONG_RU.some((r) => cyr.includes(r))) return true;
      const lat = collapse(mapChars(joined, TO_LAT));
      if (STRONG_EN.some((r) => lat.includes(r))) return true;
    }
  }
  return false;
}

export const BAD_WORDS_MESSAGE = "В сообщении есть недопустимые слова. Пожалуйста, перепишите его без грубостей.";
