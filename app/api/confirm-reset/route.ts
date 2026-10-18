import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { lockCheck, lockClear, lockFail, lockedResponse, rateLimit } from "@/lib/rateLimit";
import { logSecurity } from "@/lib/security";
import { findUserForReset } from "@/lib/resetServer";

export const dynamic = "force-dynamic";

// Второй шаг сброса: проверяем код из Telegram и меняем пароль.
// Неверный код 5 раз подряд — блокировка на 15 минут, час, сутки.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = body?.code ? String(body.code).trim() : "";
  const newPassword = body?.new_password ? String(body.new_password) : "";

  if (!code || !/^\d{6}$/.test(code) || !newPassword) {
    return NextResponse.json({ error: "Заполните все поля." }, { status: 400 });
  }
  if (newPassword.length < 8 || newPassword.length > 100) {
    return NextResponse.json({ error: "Пароль должен быть от 8 символов." }, { status: 400 });
  }

  const limited = await rateLimit(req, "resetconf", 20, 600);
  if (limited) return limited;

  const user = await findUserForReset(body);
  if (!user) return NextResponse.json({ error: "Код неверный или устарел." }, { status: 400 });

  const lockKey = `reset:user:${user.id}`;
  const c = await lockCheck(lockKey);
  if (c.locked) return lockedResponse(c.retry);

  const { data: resetRow } = await supabaseAdmin
    .from("password_reset_codes")
    .select("id, expires_at, used")
    .eq("user_id", user.id)
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resetRow || resetRow.used || new Date(resetRow.expires_at) < new Date()) {
    const f = await lockFail(lockKey, 5);
    if (f.locked) {
      await logSecurity("reset_locked", {}, { req, userId: user.id });
      return lockedResponse(f.retry);
    }
    return NextResponse.json({ error: "Код неверный или устарел." }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (updateError) return NextResponse.json({ error: "Не удалось сменить пароль." }, { status: 400 });

  await supabaseAdmin.from("password_reset_codes").update({ used: true }).eq("user_id", user.id).eq("used", false);
  await lockClear(lockKey);
  return NextResponse.json({ ok: true });
}
