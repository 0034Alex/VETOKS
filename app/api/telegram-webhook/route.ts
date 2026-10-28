import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";
import { qualifyReferral } from "@/lib/referral";
import { logSecurity } from "@/lib/security";
import { lockCheck, lockClear, lockFail, waitText } from "@/lib/rateLimit";
import { AsyncLocalStorage } from "async_hooks";
import { botForCountry } from "@/lib/countryBot";
import { tx, txMarkup, pickBotLang, type BotLang } from "@/lib/botText";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_ENV = process.env.TELEGRAM_BOT_TOKEN!;
// Токен бота той страны, чей вебхук сейчас обрабатываем (?c=<страна>); без него — общий бот.
const botCtx = new AsyncLocalStorage<string>();
const botToken = () => botCtx.getStore() || BOT_ENV;

// Язык чата: из профиля (users.language), иначе из Telegram, по умолчанию украинский.
const chatLang = new Map<string, BotLang>();
async function setChatLang(chatId: string | number, from?: any) {
  let prof: string | null = null;
  try {
    const { data } = await supabaseAdmin.from("users").select("language").eq("telegram_id", String(chatId)).limit(1).maybeSingle();
    prof = (data as any)?.language ?? null;
  } catch {}
  chatLang.set(String(chatId), pickBotLang(prof, from?.language_code));
}

async function sendMessage(chatId: string | number, text: string, extra?: object) {
  const lang = chatLang.get(String(chatId)) ?? "uk";
  await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: tx(lang, text), ...(txMarkup(lang, extra) ?? {}) }),
  });
}

const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

async function handleCode(chatId: string, code: string, username: string | undefined) {
  // Подбор кодов через бота: 5 неверных подряд — блокировка этого чата (15 мин → час → сутки).
  const lockKey = `botcode:${chatId}`;
  const lk = await lockCheck(lockKey);
  if (lk.locked) {
    await sendMessage(chatId, `Слишком много неверных кодов. Повторите через ${waitText(lk.retry)}.`);
    return;
  }
  // Код принимается только от Telegram-аккаунта владельца: его бот и отправил.
  const { data: codeRows } = await supabaseAdmin
    .from("password_reset_codes")
    .select("id, user_id, expires_at, used, users!inner(telegram_id)")
    .eq("code", code)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(5);
  const codeRow = (codeRows ?? []).find((r: any) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return String(u?.telegram_id ?? "") === String(chatId);
  });

  if (!codeRow || codeRow.used || new Date(codeRow.expires_at) < new Date()) {
    const lf = await lockFail(lockKey, 5);
    if (lf.locked) await logSecurity("bot_code_locked", { chat: String(chatId) });
    await sendMessage(chatId, "Код неверный или уже истёк. Запросите новый код в приложении.");
    return;
  }
  await lockClear(lockKey);

  await supabaseAdmin.from("password_reset_codes").update({ used: true }).eq("id", codeRow.id);
  await supabaseAdmin.from("telegram_reset_sessions").upsert({
    chat_id: chatId,
    user_id: codeRow.user_id,
    step: "awaiting_password",
  });

  // Запоминаем привязку telegram-аккаунта к пользователю на будущее.
  await supabaseAdmin.from("telegram_links").upsert({
    user_id: codeRow.user_id,
    chat_id: chatId,
    telegram_username: username ?? null,
    linked_at: new Date().toISOString(),
  });

  await sendMessage(chatId, "Код подтверждён! Введите новый пароль (минимум 8 символов):");
}

// Вход через бота из обычного браузера: /start login_<токен>
async function handleLogin(chatId: string, token: string, from: any) {
  const { data: row } = await supabaseAdmin
    .from("tg_login_tokens")
    .select("token, status, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!row || row.used || row.status !== "pending" || new Date(row.expires_at) < new Date()) {
    await sendMessage(chatId, "Ссылка для входа устарела. Вернитесь в приложение и нажмите «Войти через Telegram» ещё раз.");
    return;
  }

  await supabaseAdmin
    .from("tg_login_tokens")
    .update({
      status: "confirmed",
      telegram_id: String(from.id),
      tg_first_name: from.first_name ?? null,
    })
    .eq("token", token);

  await sendMessage(chatId, "✅ Вход подтверждён. Вернитесь в приложение VETOKS — оно откроется само.");
}

// Подтверждение номера: /start verify_<токен> -> просим поделиться контактом.
async function handleVerifyStart(chatId: string, token: string, from: any) {
  const { data: row } = await supabaseAdmin
    .from("phone_verify_tokens")
    .select("token, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    await sendMessage(chatId, "Ссылка устарела. Вернитесь в приложение и нажмите «Подтвердить номер» ещё раз.");
    return;
  }

  await supabaseAdmin
    .from("phone_verify_tokens")
    .update({ telegram_id: String(from.id) })
    .eq("token", token);

  await sendMessage(
    chatId,
    "Чтобы подтвердить номер, нажмите кнопку ниже «Поделиться номером».",
    {
      reply_markup: {
        keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

// Пришёл контакт (номер) от человека.
async function handleContact(chatId: string, message: any) {
  const contact = message.contact;
  const from = message.from;

  // Принимаем только СВОЙ номер, не чужой контакт.
  if (!contact?.phone_number || !from?.id || contact.user_id !== from.id) {
    await sendMessage(chatId, "Нужно поделиться именно своим номером — через кнопку «Поделиться номером».");
    return;
  }

  const phone = normalizePhone(contact.phone_number);
  const tgId = String(from.id);

  await supabaseAdmin.from("telegram_contacts").upsert({
    telegram_id: tgId,
    phone,
    updated_at: new Date().toISOString(),
  });

  const { data: tokenRow } = await supabaseAdmin
    .from("phone_verify_tokens")
    .select("token, user_id")
    .eq("telegram_id", tgId)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow) {
    await sendMessage(chatId, "Номер получен. Теперь вернитесь в приложение.", REMOVE_KEYBOARD);
    return;
  }

  // Этот номер уже подтверждён в другом аккаунте?
  const { data: phoneOwner } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("phone", phone)
    .eq("phone_verified", true)
    .neq("id", tokenRow.user_id)
    .limit(1)
    .maybeSingle();
  if (phoneOwner) {
    await sendMessage(chatId, "Этот номер уже подтверждён в другом аккаунте VETOKS. Один номер — один аккаунт.", REMOVE_KEYBOARD);
    return;
  }

  // Этот Telegram уже привязан к другому аккаунту?
  const { data: tgOwner } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("telegram_id", tgId)
    .neq("id", tokenRow.user_id)
    .limit(1)
    .maybeSingle();
  if (tgOwner) {
    await sendMessage(chatId, "Этот Telegram уже привязан к другому аккаунту VETOKS. Один Telegram — один аккаунт.", REMOVE_KEYBOARD);
    return;
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      phone,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
      telegram_id: tgId,
    })
    .eq("id", tokenRow.user_id);

  if (error) {
    await sendMessage(chatId, "Не получилось подтвердить номер. Попробуйте ещё раз из приложения.", REMOVE_KEYBOARD);
    return;
  }

  await supabaseAdmin.from("phone_verify_tokens").update({ used: true }).eq("token", tokenRow.token);
  await qualifyReferral(tokenRow.user_id);
  await supabaseAdmin.from("telegram_links").upsert({
    user_id: tokenRow.user_id,
    chat_id: chatId,
    telegram_username: from.username ?? null,
    linked_at: new Date().toISOString(),
  });

  await sendMessage(chatId, "✅ Номер подтверждён! Возвращайтесь в приложение VETOKS.", REMOVE_KEYBOARD);
}


// ---------- Согласие родителей (категория TEEN 15–17) ----------
async function handleParentStart(chatId: string, token: string, from: any, origin: string) {
  const { data: row } = await supabaseAdmin
    .from("parental_consents")
    .select("id, user_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!row || row.status !== "pending" || new Date(row.expires_at) < new Date()) {
    await sendMessage(chatId, "Посилання застаріло або вже використане. Попросіть доньку створити нове в застосунку VETOKS.");
    return;
  }
  const { data: kid } = await supabaseAdmin.from("users").select("first_name, telegram_id").eq("id", row.user_id).maybeSingle();
  if (kid?.telegram_id && String(kid.telegram_id) === String(from.id)) {
    await sendMessage(chatId, "Згоду має дати один із батьків або опікунів — з їхнього власного Telegram, не з акаунта учасниці.");
    return;
  }
  await supabaseAdmin
    .from("parental_consents")
    .update({ parent_telegram_id: String(from.id), parent_tg_username: from.username ?? null })
    .eq("id", row.id);
  await sendMessage(
    chatId,
    `👑 VETOKS — конкурс краси.\n\n${kid?.first_name ?? "Ваша донька"} (15–17 років) хоче взяти участь у категорії TEEN. Для цього потрібна згода одного з батьків або опікунів.\n\nЩо це означає:\n• фото та відео доньки публікуються в застосунку;\n• у застосунку є платні функції (голоси, подарунки), їх оплата можлива лише з вашою згодою;\n• підлітки спілкуються лише з підлітками, «чорних міток» у TEEN немає;\n• ви можете будь-коли відкликати згоду командою /stop — доступ до платних функцій і участь буде призупинено.\n\nДокументи: ${origin}/documents`,
    { reply_markup: { inline_keyboard: [[{ text: "✅ Я батько/мати/опікун і даю згоду", callback_data: `pc_yes_${token}` }]] } }
  );
}

async function handleParentYes(chatId: string, token: string, from: any) {
  const { data: row } = await supabaseAdmin
    .from("parental_consents")
    .select("id, status, expires_at, parent_telegram_id")
    .eq("token", token)
    .maybeSingle();
  if (!row || row.status !== "pending" || new Date(row.expires_at) < new Date() || String(row.parent_telegram_id) !== String(from.id)) {
    await sendMessage(chatId, "Посилання застаріло. Попросіть доньку створити нове в застосунку.");
    return;
  }
  await supabaseAdmin
    .from("parental_consents")
    .update({ status: "await_phone", parent_name: [from.first_name, from.last_name].filter(Boolean).join(" ") || null })
    .eq("id", row.id);
  await sendMessage(chatId, "Дякуємо. Останній крок — підтвердіть свій номер телефону кнопкою нижче.", {
    reply_markup: {
      keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// Возвращает true, если контакт был ответом родителя.
async function handleParentContact(chatId: string, message: any): Promise<boolean> {
  const from = message.from;
  const { data: row } = await supabaseAdmin
    .from("parental_consents")
    .select("id, user_id")
    .eq("parent_telegram_id", String(from?.id ?? ""))
    .eq("status", "await_phone")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return false;
  const contact = message.contact;
  if (!contact?.phone_number || contact.user_id !== from.id) {
    await sendMessage(chatId, "Потрібен саме ваш номер — через кнопку «Поділитися номером».");
    return true;
  }
  await supabaseAdmin
    .from("parental_consents")
    .update({
      status: "approved",
      parent_phone: normalizePhone(contact.phone_number),
      agreed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  await sendMessage(chatId, "✅ Згоду отримано. Щоб відкликати її, напишіть /stop.", REMOVE_KEYBOARD);
  await supabaseAdmin.from("notifications").insert({
    user_id: row.user_id,
    message: "✅ Батьки підтвердили участь. Тепер вам доступні всі функції TEEN.",
    link: "/profile",
  });
  return true;
}

async function handleParentStop(chatId: string) {
  const { data } = await supabaseAdmin
    .from("parental_consents")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("parent_telegram_id", chatId)
    .eq("status", "approved")
    .select("user_id");
  if (!data || data.length === 0) {
    await sendMessage(chatId, "Активних згод немає.");
    return;
  }
  for (const r of data as any[]) {
    await supabaseAdmin.from("notifications").insert({
      user_id: r.user_id,
      message: "⛔ Батьки відкликали згоду. Платні функції призупинено.",
      link: "/parent-consent",
    });
  }
  await sendMessage(chatId, "Згоду відкликано. Платні функції для доньки призупинено.");
}

export async function POST(req: Request) {
  const cid = new URL(req.url).searchParams.get("c");
  const token = cid ? (await botForCountry(cid)).token : BOT_ENV;
  return botCtx.run(token || BOT_ENV, () => handle(req));
}

async function handle(req: Request) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token") || "";
  const wanted = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const a = Buffer.from(secretHeader);
  const b2 = Buffer.from(wanted);
  if (wanted && !(a.length === b2.length && timingSafeEqual(a, b2))) {
    await logSecurity("webhook_bad_secret", {}, { req, alert: true, dedupeKey: "wh", dedupeSec: 300 });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json();
  const cb = body?.callback_query;
  if (cb?.message?.chat?.id) await setChatLang(cb.message.chat.id, cb.from);
  else if (body?.message?.chat?.id) await setChatLang(body.message.chat.id, body.message.from);
  if (cb?.data && cb?.message?.chat?.id && /^pc_yes_[a-f0-9]{32}$/.test(String(cb.data))) {
    await handleParentYes(String(cb.message.chat.id), String(cb.data).slice(7), cb.from);
    return NextResponse.json({ ok: true });
  }

  const message = body?.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);

  // Контакт (подтверждение номера).
  if (message.contact) {
    if (await handleParentContact(chatId, message)) return NextResponse.json({ ok: true });
    await handleContact(chatId, message);
    return NextResponse.json({ ok: true });
  }

  if (!message.text) {
    return NextResponse.json({ ok: true });
  }

  const text = String(message.text).trim();
  const username: string | undefined = message.from?.username;

  if (text === "/stop") {
    await handleParentStop(chatId);
    return NextResponse.json({ ok: true });
  }

  // /start — приветствие, либо /start КОД (сброс пароля), либо вход/подтверждение номера.
  if (text.startsWith("/start")) {
    const param = text.split(" ")[1];

    if (param && /^\d{6}$/.test(param)) {
      await handleCode(chatId, param, username);
      return NextResponse.json({ ok: true });
    }
    if (param && /^parent_[a-f0-9]{32}$/.test(param)) {
      await handleParentStart(chatId, param.slice(7), message.from, new URL(req.url).origin);
      return NextResponse.json({ ok: true });
    }
    if (param && /^login_[a-f0-9]{32}$/.test(param)) {
      await handleLogin(chatId, param.slice(6), message.from);
      return NextResponse.json({ ok: true });
    }
    if (param && /^verify_[a-f0-9]{32}$/.test(param)) {
      await handleVerifyStart(chatId, param.slice(7), message.from);
      return NextResponse.json({ ok: true });
    }

    // Ссылка друга: t.me/бот?start=ref_КОД — открываем приложение с кодом приглашения.
    if (param && /^ref_[A-Za-z0-9_-]{2,40}$/.test(param)) {
      const origin = new URL(req.url).origin;
      await sendMessage(
        chatId,
        "👑 Друг приглашает вас в VETOKS — конкурс красоты, где голосуете вы!\n\nНажмите кнопку ниже, чтобы открыть приложение и зарегистрироваться.",
        { reply_markup: { inline_keyboard: [[{ text: "Открыть VETOKS", web_app: { url: `${origin}/r/${param.slice(4)}` } }]] } }
      );
      return NextResponse.json({ ok: true });
    }

    await sendMessage(
      chatId,
      "👑 Добро пожаловать в VETOKS!\n\nЭто официальный бот платформы VETOKS — конкурса красоты. Здесь можно войти, подтвердить номер и восстановить пароль.\n\nЧтобы открыть само приложение, нажмите кнопку меню внизу слева (☰ или «Открыть VETOKS»)."
    );
    return NextResponse.json({ ok: true });
  }

  const { data: session } = await supabaseAdmin
    .from("telegram_reset_sessions")
    .select("user_id, step")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (session?.step === "awaiting_password") {
    if (text.length < 8) {
      await sendMessage(chatId, "Пароль слишком короткий — минимум 8 символов. Попробуйте ещё раз:");
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(session.user_id, {
      password: text,
    });

    await supabaseAdmin.from("telegram_reset_sessions").delete().eq("chat_id", chatId);

    if (error) {
      await sendMessage(chatId, "Не получилось обновить пароль. Попробуйте запросить код заново в приложении.");
    } else {
      await sendMessage(
        chatId,
        "Готово! Пароль обновлён. Возвращайтесь в приложение VETOKS и входите с новым паролем."
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (/^\d{6}$/.test(text)) {
    await handleCode(chatId, text, username);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
