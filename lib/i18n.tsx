"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { ALL_LANGS, LANG_LABELS, isLang, Lang } from "@/lib/langs";
export type { Lang };
export const LANGS: { code: Lang; label: string }[] = ALL_LANGS.map((code) => ({ code, label: LANG_LABELS[code] }));

type Dict = Record<string, string>;

const ru: Dict = {
  "nav.home": "Главная",
  "nav.participants": "Участницы",
  "nav.media": "Медиа",
  "nav.shop": "Подарки",
  "nav.rating": "Рейтинг",
  "nav.profile": "Профиль",

  "home.hallOfFame": "🏆 Зал славы",
  "home.region": "Мой регион",
  "home.country": "Вся страна",
  "home.tagline": "Красота. Харизма. Энергия.",
  "home.stage": "Этап {n} из {total}",
  "home.untilEnd": "🕐 До конца:",
  "home.apply": "📝 Подать анкету",
  "home.promo": "▶ Промо-ролик",
  "home.topDay": "🔥 ТОП участниц дня",
  "home.seeAll": "Смотреть всех →",
  "home.noParticipants": "Пока нет одобренных участниц.",
  "home.applyFull": "📝 Подать анкету на участие",
  "home.soon": "Сезон скоро стартует",

  "login.title": "Вход",
  "login.noAccount": "Нет аккаунта?",
  "login.register": "Зарегистрироваться",
  "login.or": "или по почте / номеру",
  "login.identifier": "Почта или подтверждённый номер",
  "login.password": "Пароль",
  "login.forgot": "Забыли пароль?",
  "login.submit": "Войти",
  "login.loading": "Входим...",
  "login.errBad": "Неверные данные для входа или пароль.",
  "login.errFail": "Не удалось войти. Попробуйте ещё раз.",

  "profile.participant": "Участница",
  "profile.showData": "👁 Показать данные",
  "profile.hideData": "🙈 Скрыть",
  "profile.region": "Регион:",
  "profile.balance": "Баланс",
  "profile.more": "Подробнее →",
  "profile.clan": "🏰 Клан региона",
  "profile.votes": "Голосов набрано",
  "profile.gifts": "Подарков получено →",
  "profile.ideas": "💡 Идеи для контента на сегодня",
  "profile.materials": "🎬 Материалы для монтажа",
  "profile.tasks": "⭐ Задания",
  "profile.invites": "Мои приглашения",
  "profile.follows": "Мои подписки",
  "profile.blackMarks": "🖤 Полученные чёрные метки",
  "profile.edit": "Редактировать профиль",
  "profile.docs": "Документы",
  "profile.ads": "Рекламный кабинет",
  "profile.settings": "Настройки",
  "profile.support": "Помощь и поддержка",
  "profile.partnerCabinet": "🏢 Кабинет партнёра",
  "profile.becomePartner": "🤝 Стать партнёром",
  "profile.install": "📲 Установить приложение",
  "profile.logout": "Выйти",
  "profile.verifyTitle": "📱 Подтвердите номер в Telegram",
  "profile.verifyText": "Без подтверждения недоступны бесплатные голоса. Это займёт полминуты.",
  "profile.verifyBtn": "Подтвердить",

  "settings.title": "Настройки",
  "settings.phone": "Номер телефона",
  "settings.verified": "✓ Подтверждён",
  "settings.verifyHint": "Без подтверждения недоступны бесплатные голоса. Номер подтверждается через Telegram-бота.",
  "settings.verifyBtn": "Подтвердить номер",
  "settings.phoneNote": "Номер нельзя изменить вручную — только повторным подтверждением через Telegram.",
  "settings.notif": "Уведомления в Telegram",
  "settings.notifLinked": "Важные события дублируются сообщением от бота.",
  "settings.notifNotLinked": "Telegram не привязан к аккаунту — сообщения от бота не придут, уведомления будут только в приложении.",
  "settings.n.gifts": "Подарки, донаты и покупки карточек",
  "settings.n.tasks": "Задания: одобрение и награды",
  "settings.n.support": "Ответы поддержки",
  "settings.language": "Язык",
  "settings.langNote": "Перевод основных экранов. Остальные разделы пока на русском.",
};

const uk: Dict = {
  "nav.home": "Головна",
  "nav.participants": "Учасниці",
  "nav.media": "Медіа",
  "nav.shop": "Подарунки",
  "nav.rating": "Рейтинг",
  "nav.profile": "Профіль",

  "home.hallOfFame": "🏆 Зал слави",
  "home.region": "Мій регіон",
  "home.country": "Вся країна",
  "home.tagline": "Краса. Харизма. Енергія.",
  "home.stage": "Етап {n} з {total}",
  "home.untilEnd": "🕐 До кінця:",
  "home.apply": "📝 Подати анкету",
  "home.promo": "▶ Промо-ролик",
  "home.topDay": "🔥 ТОП учасниць дня",
  "home.seeAll": "Дивитися всіх →",
  "home.noParticipants": "Поки немає схвалених учасниць.",
  "home.applyFull": "📝 Подати анкету на участь",
  "home.soon": "Сезон скоро стартує",

  "login.title": "Вхід",
  "login.noAccount": "Немає акаунта?",
  "login.register": "Зареєструватися",
  "login.or": "або за поштою / номером",
  "login.identifier": "Пошта або підтверджений номер",
  "login.password": "Пароль",
  "login.forgot": "Забули пароль?",
  "login.submit": "Увійти",
  "login.loading": "Входимо...",
  "login.errBad": "Невірні дані для входу або пароль.",
  "login.errFail": "Не вдалося увійти. Спробуйте ще раз.",

  "profile.participant": "Учасниця",
  "profile.showData": "👁 Показати дані",
  "profile.hideData": "🙈 Сховати",
  "profile.region": "Регіон:",
  "profile.balance": "Баланс",
  "profile.more": "Детальніше →",
  "profile.clan": "🏰 Клан регіону",
  "profile.votes": "Голосів набрано",
  "profile.gifts": "Подарунків отримано →",
  "profile.ideas": "💡 Ідеї для контенту на сьогодні",
  "profile.materials": "🎬 Матеріали для монтажу",
  "profile.tasks": "⭐ Завдання",
  "profile.invites": "Мої запрошення",
  "profile.follows": "Мої підписки",
  "profile.blackMarks": "🖤 Отримані чорні мітки",
  "profile.edit": "Редагувати профіль",
  "profile.docs": "Документи",
  "profile.ads": "Рекламний кабінет",
  "profile.settings": "Налаштування",
  "profile.support": "Допомога та підтримка",
  "profile.partnerCabinet": "🏢 Кабінет партнера",
  "profile.becomePartner": "🤝 Стати партнером",
  "profile.install": "📲 Встановити застосунок",
  "profile.logout": "Вийти",
  "profile.verifyTitle": "📱 Підтвердіть номер у Telegram",
  "profile.verifyText": "Без підтвердження недоступні безкоштовні голоси. Це займе пів хвилини.",
  "profile.verifyBtn": "Підтвердити",

  "settings.title": "Налаштування",
  "settings.phone": "Номер телефону",
  "settings.verified": "✓ Підтверджено",
  "settings.verifyHint": "Без підтвердження недоступні безкоштовні голоси. Номер підтверджується через Telegram-бота.",
  "settings.verifyBtn": "Підтвердити номер",
  "settings.phoneNote": "Номер не можна змінити вручну — лише повторним підтвердженням через Telegram.",
  "settings.notif": "Сповіщення в Telegram",
  "settings.notifLinked": "Важливі події дублюються повідомленням від бота.",
  "settings.notifNotLinked": "Telegram не прив'язано до акаунта — повідомлення від бота не надійдуть, сповіщення будуть лише в застосунку.",
  "settings.n.gifts": "Подарунки, донати та купівля карток",
  "settings.n.tasks": "Завдання: схвалення та нагороди",
  "settings.n.support": "Відповіді підтримки",
  "settings.language": "Мова",
  "settings.langNote": "Переклад основних екранів. Інші розділи поки російською.",
};

const en: Dict = {
  "nav.home": "Home",
  "nav.participants": "Contestants",
  "nav.media": "Media",
  "nav.shop": "Gifts",
  "nav.rating": "Ranking",
  "nav.profile": "Profile",

  "home.hallOfFame": "🏆 Hall of Fame",
  "home.region": "My region",
  "home.country": "Whole country",
  "home.tagline": "Beauty. Charisma. Energy.",
  "home.stage": "Stage {n} of {total}",
  "home.untilEnd": "🕐 Time left:",
  "home.apply": "📝 Apply",
  "home.promo": "▶ Promo video",
  "home.topDay": "🔥 TOP contestants today",
  "home.seeAll": "See all →",
  "home.noParticipants": "No approved contestants yet.",
  "home.applyFull": "📝 Apply to take part",
  "home.soon": "The season starts soon",

  "login.title": "Sign in",
  "login.noAccount": "No account?",
  "login.register": "Sign up",
  "login.or": "or with email / phone",
  "login.identifier": "Email or verified phone",
  "login.password": "Password",
  "login.forgot": "Forgot password?",
  "login.submit": "Sign in",
  "login.loading": "Signing in...",
  "login.errBad": "Wrong login or password.",
  "login.errFail": "Could not sign in. Please try again.",

  "profile.participant": "Contestant",
  "profile.showData": "👁 Show details",
  "profile.hideData": "🙈 Hide",
  "profile.region": "Region:",
  "profile.balance": "Balance",
  "profile.more": "Details →",
  "profile.clan": "🏰 Region clan",
  "profile.votes": "Votes collected",
  "profile.gifts": "Gifts received →",
  "profile.ideas": "💡 Content ideas for today",
  "profile.materials": "🎬 Editing materials",
  "profile.tasks": "⭐ Tasks",
  "profile.invites": "My invitations",
  "profile.follows": "My follows",
  "profile.blackMarks": "🖤 Black marks received",
  "profile.edit": "Edit profile",
  "profile.docs": "Documents",
  "profile.ads": "Advertising account",
  "profile.settings": "Settings",
  "profile.support": "Help & support",
  "profile.partnerCabinet": "🏢 Partner account",
  "profile.becomePartner": "🤝 Become a partner",
  "profile.install": "📲 Install the app",
  "profile.logout": "Log out",
  "profile.verifyTitle": "📱 Verify your number in Telegram",
  "profile.verifyText": "Free votes are unavailable until you verify. It takes half a minute.",
  "profile.verifyBtn": "Verify",

  "settings.title": "Settings",
  "settings.phone": "Phone number",
  "settings.verified": "✓ Verified",
  "settings.verifyHint": "Free votes are unavailable until you verify. The number is verified via the Telegram bot.",
  "settings.verifyBtn": "Verify number",
  "settings.phoneNote": "The number can't be edited by hand — only re-verified through Telegram.",
  "settings.notif": "Telegram notifications",
  "settings.notifLinked": "Important events are duplicated as a message from the bot.",
  "settings.notifNotLinked": "Telegram is not linked to your account — you'll only get in-app notifications.",
  "settings.n.gifts": "Gifts, donations and card purchases",
  "settings.n.tasks": "Tasks: approvals and rewards",
  "settings.n.support": "Support replies",
  "settings.language": "Language",
  "settings.langNote": "Main screens are translated. Other sections are in Russian for now.",
};

const DICTS: Partial<Record<Lang, Dict>> = { ru, uk, en };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };

const LangContext = createContext<Ctx>({
  lang: "ru",
  setLang: () => {},
  t: (k) => ru[k] ?? k,
});

function detect(): Lang {
  try {
    const saved = localStorage.getItem("vt_lang");
    if (isLang(saved)) return saved;
    const nav = (navigator.language || "ru").toLowerCase().slice(0, 2);
    if (isLang(nav)) return nav;
  } catch {}
  return "ru";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    setLangState(detect());
    // язык, сохранённый в аккаунте, важнее
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: row } = await supabase.from("users").select("language").eq("id", data.user.id).maybeSingle();
      const l = row?.language;
      if (isLang(l)) {
        setLangState(l);
        try { localStorage.setItem("vt_lang", l); } catch {}
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("vt_lang", l); } catch {}
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from("users").update({ language: l }).eq("id", data.user.id);
    })();
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = (DICTS as Record<string, Dict | undefined>)[lang]?.[key] ?? ru[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang]
  );

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
