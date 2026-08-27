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

export async function POST(req: Request) {
  // Простая защита: Telegram присылает секретный заголовок, если мы его
  // задали при регистрации вебхука — сверяем, если он настроен.
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

  // Есть ли уже активная сессия сброса для этого чата?
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

  // Иначе ждём 6-значный код из приложения.
  if (/^\d{6}$/.test(text)) {
    const { data: codeRow } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id, user_id, expires_at, used")
      .eq("code", text)
      .maybeSingle();

    if (!codeRow || codeRow.used || new Date(codeRow.expires_at) < new Date()) {
      await sendMessage(chatId, "Код неверный или уже истёк. Запросите новый код в приложении.");
      return NextResponse.json({ ok: true });
    }

    await supabaseAdmin.from("password_reset_codes").update({ used: true }).eq("id", codeRow.id);
    await supabaseAdmin.from("telegram_reset_sessions").upsert({
      chat_id: chatId,
      user_id: codeRow.user_id,
      step: "awaiting_password",
    });

    await sendMessage(chatId, "Код подтверждён! Введите новый пароль (минимум 6 символов):");
    return NextResponse.json({ ok: true });
  }

  await sendMessage(
    chatId,
    "Здравствуйте! Чтобы сбросить пароль, сначала запросите код в приложении VETOKS (кнопка «Забыли пароль?»), затем пришлите его сюда."
  );
  return NextResponse.json({ ok: true });
}
