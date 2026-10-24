import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { findUserForReset } from "@/lib/resetServer";
import { tx, pickBotLang } from "@/lib/botText";

export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Просим код для сброса пароля. Код уходит ТОЛЬКО владельцу аккаунта — в его Telegram.
// Ответ всегда одинаковый, чтобы нельзя было выяснить, есть ли такой аккаунт.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const target = String(body.identifier ?? body.telegram_id ?? "").trim().toLowerCase();
  if (!target || target.length > 120) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  if (!(await verifyTurnstile(body.turnstile, req)))
    return NextResponse.json({ ok: false, error: "captcha", message: "Подтвердите, что вы не робот." }, { status: 400 });

  const limited = await rateLimit(req, "resetreq", 8, 600, target);
  if (limited) return limited;
  // Не больше 3 кодов в 10 минут на один аккаунт.
  const per = await rateLimit(req, "resetreq3", 3, 600, target);
  if (per) return per;

  const user = await findUserForReset(body);
  if (user && user.telegram_id && BOT_TOKEN) {
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    // Старые неиспользованные коды гасим: действует только последний.
    await supabaseAdmin.from("password_reset_codes").update({ used: true }).eq("user_id", user.id).eq("used", false);
    await supabaseAdmin.from("password_reset_codes").insert({ user_id: user.id, code, expires_at: expiresAt });
    let resetLang = pickBotLang(null, null);
    try {
      const { data: lu } = await supabaseAdmin.from("users").select("language").eq("id", user.id).maybeSingle();
      resetLang = pickBotLang((lu as any)?.language ?? null, null);
    } catch {}
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(user.telegram_id),
        text: tx(resetLang, `Код для сброса пароля VETOKS: ${code}\n\nДействует 10 минут. Никому его не сообщайте. Если вы не запрашивали сброс — просто игнорируйте это сообщение.`),
      }),
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
