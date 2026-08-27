import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

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
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = String(message.text).trim();
  const username: string | undefined = message.from?.username;

  // /start — либо простое приветствие, либо /start КОД (deep-link из приложения).
  if (text.startsWith("/start")) {
    const param = text.split(" ")[1];
    if (param && /^\d{6}$/.test(param)) {
      await handleCode(chatId, param, username);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(
      chatId,
      "👑 Добро пожаловать в VETOKS!\n\nЭто официальный бот платформы VETOKS — конкурса красоты. Здесь можно восстановить пароль, если забыли его в приложении.\n\nЧтобы открыть само приложение, нажмите кнопку меню внизу слева (☰ или «Открыть VETOKS»)."
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

  await sendMessage(
    chatId,
    "Чтобы сбросить пароль, запросите код в приложении VETOKS (кнопка «Забыли пароль?»), затем пришлите его сюда."
  );
  return NextResponse.json({ ok: true });
}
