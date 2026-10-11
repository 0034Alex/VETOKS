import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyInitData } from "@/lib/telegramAuth";
import { findUserByTelegramId, tgEmail, tokenHashForUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Регистрация через Telegram: без почты и пароля.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim().slice(0, 60);
  const regionId = String(body.regionId || "");
  if (!firstName) return NextResponse.json({ status: "error", message: "Введите имя." });
  if (!regionId) return NextResponse.json({ status: "error", message: "Выберите регион." });
  if (!body.agreed) {
    return NextResponse.json({
      status: "error",
      message: "Нужно принять пользовательское соглашение и публичную оферту.",
    });
  }

  // Кто это: либо подпись мини-приложения, либо подтверждённый вход через бота.
  let telegramId: string | null = null;
  let loginToken: string | null = null;

  const tg = body.initData ? verifyInitData(String(body.initData)) : null;
  if (tg) {
    telegramId = String(tg.id);
  } else if (body.loginToken) {
    const { data: row } = await supabaseAdmin
      .from("tg_login_tokens")
      .select("token, status, telegram_id, expires_at, used")
      .eq("token", String(body.loginToken))
      .maybeSingle();
    if (
      row &&
      !row.used &&
      row.status === "confirmed" &&
      row.telegram_id &&
      new Date(row.expires_at) > new Date(Date.now() - 30 * 60 * 1000)
    ) {
      telegramId = String(row.telegram_id);
      loginToken = row.token;
    }
  }
  if (!telegramId) {
    return NextResponse.json({
      status: "error",
      message: "Не удалось подтвердить Telegram. Попробуйте ещё раз.",
    });
  }

  if (await findUserByTelegramId(telegramId)) {
    return NextResponse.json({
      status: "error",
      message: "Этот Telegram уже зарегистрирован — просто войдите.",
    });
  }

  // Регион должен принадлежать включённой стране.
  const { data: region } = await supabaseAdmin
    .from("regions")
    .select("id, country_id")
    .eq("id", regionId)
    .maybeSingle();
  if (!region) return NextResponse.json({ status: "error", message: "Неверный регион." });
  if (region.country_id) {
    const { data: country } = await supabaseAdmin
      .from("countries")
      .select("enabled")
      .eq("id", region.country_id)
      .maybeSingle();
    if (!country?.enabled) {
      return NextResponse.json({ status: "error", message: "Этот регион сейчас недоступен." });
    }
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: tgEmail(telegramId),
    password: randomBytes(24).toString("hex"),
    email_confirm: true,
  });
  if (createError || !created?.user) {
    return NextResponse.json({
      status: "error",
      message: "Не удалось создать аккаунт. Попробуйте ещё раз.",
    });
  }

  const { error: insertError } = await supabaseAdmin.from("users").insert({
    id: created.user.id,
    first_name: firstName,
    region_id: regionId,
    telegram_id: telegramId,
    role: "viewer",
  });
  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ status: "error", message: "Не удалось сохранить профиль." });
  }

  if (loginToken) {
    await supabaseAdmin.from("tg_login_tokens").update({ used: true }).eq("token", loginToken);
  }

  const tokenHash = await tokenHashForUser(created.user.id);
  if (!tokenHash) return NextResponse.json({ status: "error", message: "Ошибка входа." });
  return NextResponse.json({ status: "ok", token_hash: tokenHash });
}
