// Тексты Telegram-бота на трёх языках. Основной — украинский.
// Ключ — любой из вариантов текста (uk или ru); {} — подставляемое значение.
export type BotLang = "uk" | "ru" | "en";

type E = { uk: string; ru: string; en: string };

const LIST: E[] = [
  {
    uk: "👑 Ласкаво просимо до VETOKS!\n\nЦе офіційний бот платформи VETOKS — конкурсу краси. Тут можна увійти, підтвердити номер і відновити пароль.\n\nЩоб відкрити сам застосунок, натисніть кнопку меню внизу ліворуч (☰ або «Відкрити VETOKS»).",
    ru: "👑 Добро пожаловать в VETOKS!\n\nЭто официальный бот платформы VETOKS — конкурса красоты. Здесь можно войти, подтвердить номер и восстановить пароль.\n\nЧтобы открыть само приложение, нажмите кнопку меню внизу слева (☰ или «Открыть VETOKS»).",
    en: "👑 Welcome to VETOKS!\n\nThis is the official bot of the VETOKS beauty contest platform. Here you can log in, confirm your number and restore your password.\n\nTo open the app itself, tap the menu button at the bottom left (☰ or “Open VETOKS”).",
  },
  {
    uk: "👑 Друг запрошує вас до VETOKS — конкурсу краси, де голосуєте ви!\n\nНатисніть кнопку нижче, щоб відкрити застосунок і зареєструватися.",
    ru: "👑 Друг приглашает вас в VETOKS — конкурс красоты, где голосуете вы!\n\nНажмите кнопку ниже, чтобы открыть приложение и зарегистрироваться.",
    en: "👑 A friend invites you to VETOKS — a beauty contest where you vote!\n\nTap the button below to open the app and sign up.",
  },
  { uk: "Відкрити VETOKS", ru: "Открыть VETOKS", en: "Open VETOKS" },
  { uk: "Занадто багато невірних кодів. Повторіть через {}.", ru: "Слишком много неверных кодов. Повторите через {}.", en: "Too many wrong codes. Try again in {}." },
  { uk: "Код невірний або вже закінчився. Запросіть новий код у застосунку.", ru: "Код неверный или уже истёк. Запросите новый код в приложении.", en: "The code is wrong or has expired. Request a new code in the app." },
  { uk: "Код підтверджено! Введіть новий пароль (мінімум 8 символів):", ru: "Код подтверждён! Введите новый пароль (минимум 8 символов):", en: "Code confirmed! Enter a new password (at least 8 characters):" },
  { uk: "Посилання для входу застаріло. Поверніться в застосунок і натисніть «Увійти через Telegram» ще раз.", ru: "Ссылка для входа устарела. Вернитесь в приложение и нажмите «Войти через Telegram» ещё раз.", en: "The login link has expired. Go back to the app and tap “Log in with Telegram” again." },
  { uk: "✅ Вхід підтверджено. Поверніться в застосунок VETOKS — він відкриється сам.", ru: "✅ Вход подтверждён. Вернитесь в приложение VETOKS — оно откроется само.", en: "✅ Login confirmed. Go back to the VETOKS app — it will open by itself." },
  { uk: "Посилання застаріло. Поверніться в застосунок і натисніть «Підтвердити номер» ще раз.", ru: "Ссылка устарела. Вернитесь в приложение и нажмите «Подтвердить номер» ещё раз.", en: "The link has expired. Go back to the app and tap “Confirm number” again." },
  { uk: "Щоб підтвердити номер, натисніть кнопку нижче «Поділитися номером».", ru: "Чтобы подтвердить номер, нажмите кнопку ниже «Поделиться номером».", en: "To confirm your number, tap the “Share number” button below." },
  { uk: "📱 Поділитися номером", ru: "📱 Поделиться номером", en: "📱 Share number" },
  { uk: "Потрібно поділитися саме своїм номером — через кнопку «Поділитися номером».", ru: "Нужно поделиться именно своим номером — через кнопку «Поделиться номером».", en: "You need to share your own number — using the “Share number” button." },
  { uk: "Номер отримано. Тепер поверніться в застосунок.", ru: "Номер получен. Теперь вернитесь в приложение.", en: "Number received. Now go back to the app." },
  { uk: "Цей номер уже підтверджено в іншому акаунті VETOKS. Один номер — один акаунт.", ru: "Этот номер уже подтверждён в другом аккаунте VETOKS. Один номер — один аккаунт.", en: "This number is already confirmed in another VETOKS account. One number — one account." },
  { uk: "Цей Telegram уже прив'язано до іншого акаунта VETOKS. Один Telegram — один акаунт.", ru: "Этот Telegram уже привязан к другому аккаунту VETOKS. Один Telegram — один аккаунт.", en: "This Telegram is already linked to another VETOKS account. One Telegram — one account." },
  { uk: "Не вдалося підтвердити номер. Спробуйте ще раз із застосунку.", ru: "Не получилось подтвердить номер. Попробуйте ещё раз из приложения.", en: "Could not confirm the number. Try again from the app." },
  { uk: "✅ Номер підтверджено! Повертайтеся до застосунку VETOKS.", ru: "✅ Номер подтверждён! Возвращайтесь в приложение VETOKS.", en: "✅ Number confirmed! Go back to the VETOKS app." },
  { uk: "Пароль занадто короткий — мінімум 8 символів. Спробуйте ще раз:", ru: "Пароль слишком короткий — минимум 8 символов. Попробуйте ещё раз:", en: "The password is too short — at least 8 characters. Try again:" },
  { uk: "Не вдалося оновити пароль. Спробуйте запросити код знову в застосунку.", ru: "Не получилось обновить пароль. Попробуйте запросить код заново в приложении.", en: "Could not update the password. Try requesting a new code in the app." },
  { uk: "Готово! Пароль оновлено. Повертайтеся до застосунку VETOKS і входьте з новим паролем.", ru: "Готово! Пароль обновлён. Возвращайтесь в приложение VETOKS и входите с новым паролем.", en: "Done! Password updated. Go back to the VETOKS app and log in with your new password." },
  // согласие родителей (TEEN)
  { uk: "Посилання застаріло або вже використане. Попросіть доньку створити нове в застосунку VETOKS.", ru: "Ссылка устарела или уже использована. Попросите дочь создать новую в приложении VETOKS.", en: "The link has expired or was already used. Ask your daughter to create a new one in the VETOKS app." },
  { uk: "Згоду має дати один із батьків або опікунів — з їхнього власного Telegram, не з акаунта учасниці.", ru: "Согласие должен дать один из родителей или опекунов — из своего Telegram, не из аккаунта участницы.", en: "Consent must be given by a parent or guardian — from their own Telegram, not the participant's account." },
  {
    uk: "👑 VETOKS — конкурс краси.\n\n{} (15–17 років) хоче взяти участь у категорії TEEN. Для цього потрібна згода одного з батьків або опікунів.\n\nЩо це означає:\n• фото та відео доньки публікуються в застосунку;\n• у застосунку є платні функції (голоси, подарунки), їх оплата можлива лише з вашою згодою;\n• підлітки спілкуються лише з підлітками, «чорних міток» у TEEN немає;\n• ви можете будь-коли відкликати згоду командою /stop — доступ до платних функцій і участь буде призупинено.\n\nДокументи: {}",
    ru: "👑 VETOKS — конкурс красоты.\n\n{} (15–17 лет) хочет участвовать в категории TEEN. Для этого нужно согласие одного из родителей или опекунов.\n\nЧто это значит:\n• фото и видео дочери публикуются в приложении;\n• в приложении есть платные функции (голоса, подарки), их оплата возможна только с вашего согласия;\n• подростки общаются только с подростками, «чёрных меток» в TEEN нет;\n• вы можете в любой момент отозвать согласие командой /stop — доступ к платным функциям и участие будут приостановлены.\n\nДокументы: {}",
    en: "👑 VETOKS — a beauty contest.\n\n{} (15–17 years old) wants to take part in the TEEN category. This requires the consent of one parent or guardian.\n\nWhat this means:\n• your daughter's photos and videos are published in the app;\n• the app has paid features (votes, gifts); payment is possible only with your consent;\n• teens communicate only with teens, there are no “black marks” in TEEN;\n• you can withdraw consent at any time with the /stop command — access to paid features and participation will be suspended.\n\nDocuments: {}",
  },
  { uk: "✅ Я батько/мати/опікун і даю згоду", ru: "✅ Я родитель/опекун и даю согласие", en: "✅ I am a parent/guardian and I consent" },
  { uk: "Ваша донька", ru: "Ваша дочь", en: "Your daughter" },
  { uk: "Посилання застаріло. Попросіть доньку створити нове в застосунку.", ru: "Ссылка устарела. Попросите дочь создать новую в приложении.", en: "The link has expired. Ask your daughter to create a new one in the app." },
  { uk: "Дякуємо. Останній крок — підтвердіть свій номер телефону кнопкою нижче.", ru: "Спасибо. Последний шаг — подтвердите свой номер телефона кнопкой ниже.", en: "Thank you. The last step — confirm your phone number with the button below." },
  { uk: "Потрібен саме ваш номер — через кнопку «Поділитися номером».", ru: "Нужен именно ваш номер — через кнопку «Поделиться номером».", en: "We need your own number — via the “Share number” button." },
  { uk: "✅ Згоду отримано. Щоб відкликати її, напишіть /stop.", ru: "✅ Согласие получено. Чтобы отозвать его, напишите /stop.", en: "✅ Consent received. To withdraw it, write /stop." },
  { uk: "✅ Батьки підтвердили участь. Тепер вам доступні всі функції TEEN.", ru: "✅ Родители подтвердили участие. Теперь вам доступны все функции TEEN.", en: "✅ Your parents confirmed participation. All TEEN features are now available." },
  { uk: "Активних згод немає.", ru: "Активных согласий нет.", en: "There are no active consents." },
  { uk: "Згоду відкликано. Платні функції для доньки призупинено.", ru: "Согласие отозвано. Платные функции для дочери приостановлены.", en: "Consent withdrawn. Paid features for your daughter are suspended." },
  // код сброса пароля
  {
    uk: "Код для скидання пароля VETOKS: {}\n\nДіє 10 хвилин. Нікому його не повідомляйте. Якщо ви не запитували скидання — просто ігноруйте це повідомлення.",
    ru: "Код для сброса пароля VETOKS: {}\n\nДействует 10 минут. Никому его не сообщайте. Если вы не запрашивали сброс — просто игнорируйте это сообщение.",
    en: "VETOKS password reset code: {}\n\nValid for 10 minutes. Do not share it with anyone. If you did not request a reset, just ignore this message.",
  },
];

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const exact = new Map<string, E>();
const pats: { re: RegExp; e: E }[] = [];
for (const e of LIST) {
  for (const l of ["uk", "ru", "en"] as const) {
    const k = norm(e[l]);
    if (k.includes("{}")) {
      const re = new RegExp("^" + k.split("{}").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([\\s\\S]*?)") + "$");
      pats.push({ re, e });
    } else exact.set(k, e);
  }
}

const UNITS: Record<BotLang, Record<string, string>> = {
  uk: { сек: "сек", мин: "хв", ч: "год", час: "год", часа: "год", часов: "год", минут: "хв", минуты: "хв", дн: "дн" },
  ru: {},
  en: { сек: "sec", мин: "min", ч: "h", час: "h", часа: "h", часов: "h", минут: "min", минуты: "min", дн: "d" },
};
function unit(v: string, lang: BotLang): string {
  if (lang === "ru") return v;
  return v.replace(/[А-Яа-я]+/g, (w) => UNITS[lang][w] ?? w);
}

/** Переводит готовый текст бота на нужный язык (если он известен словарю). */
export function tx(lang: BotLang, text: string): string {
  const n = norm(text);
  const e = exact.get(n);
  if (e) return e[lang];
  for (const p of pats) {
    const m = n.match(p.re);
    if (m) {
      let i = 0;
      return p.e[lang].replace(/\{\}/g, () => unit(m[++i] ?? "", lang));
    }
  }
  return text;
}

/** Телефон/профиль/Telegram → язык бота. Основной — украинский. */
export function pickBotLang(profileLang?: string | null, tgCode?: string | null): BotLang {
  if (profileLang === "uk" || profileLang === "ru" || profileLang === "en") return profileLang;
  const c = (tgCode || "").toLowerCase();
  if (c.startsWith("ru")) return "ru";
  if (c.startsWith("en")) return "en";
  return "uk";
}

/** Переводит надписи кнопок в reply_markup. */
export function txMarkup(lang: BotLang, extra: any): any {
  if (!extra || !extra.reply_markup) return extra;
  const rm = extra.reply_markup;
  const mapRows = (rows: any[][] | undefined) =>
    rows?.map((r) => r.map((b: any) => (b?.text ? { ...b, text: tx(lang, b.text) } : b)));
  return {
    ...extra,
    reply_markup: {
      ...rm,
      ...(rm.keyboard ? { keyboard: mapRows(rm.keyboard) } : {}),
      ...(rm.inline_keyboard ? { inline_keyboard: mapRows(rm.inline_keyboard) } : {}),
    },
  };
}
