import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";
import { qualifyReferral } from "@/lib/referral";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function sendMessage(chatId: string | number, text: string, extra?: object) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(extra ?? {}) }),
  });
}

const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

async function handleCode(chatId: string, code: string, username: string | undefined) {
  const { data: codeRow } = await supabaseAdmin
    .from("password_reset_codes")
    .select("id, user_id, expires_at, used")
    .eq("code", code)
    .maybeSingle();

  if (!codeRow || codeRow.used || new Date(codeRow.expires_at) < new Date()) {
    await sendMessage(chatId, "Код неверный или уже истёк. Запросите новый код в приложении.");
    return;
  }

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

  await sendMessage(chatId, "Код подтверждён! Введите новый пароль (минимум 6 символов):");
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

export async function POST(req: Request) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json();
  const message = body?.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);

  // Контакт (подтверждение номера).
  if (message.contact) {
    await handleContact(chatId, message);
    return NextResponse.json({ ok: true });
  }

  if (!message.text) {
    return NextResponse.json({ ok: true });
  }

  const text = String(message.text).trim();
  const username: string | undefined = message.from?.username;

  // /start — приветствие, либо /start КОД (сброс пароля), либо вход/подтверждение номера.
  if (text.startsWith("/start")) {
    const param = text.split(" ")[1];

    if (param && /^\d{6}$/.test(param)) {
      await handleCode(chatId, param, username);
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
    if (text.length < 6) {
      await sendMessage(chatId, "Пароль слишком короткий — минимум 6 символов. Попробуйте ещё раз:");
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
