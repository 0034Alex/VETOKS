import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { recordActivity } from "@/lib/security";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Регистрация по почте. Аккаунт создаёт сервер: после капчи, с лимитом на адрес.
// (Прямая регистрация через Supabase для браузера выключается в настройках.)
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "register", 10, 3600);
  if (limited) return limited;

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const firstName = String(b.first_name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const regionId = String(b.region_id ?? "");

  if (!(await verifyTurnstile(b.turnstile, req)))
    return NextResponse.json({ ok: false, error: "captcha", message: "Подтвердите, что вы не робот, и попробуйте ещё раз." }, { status: 400 });

  if (!EMAIL_RE.test(email) || email.length > 120)
    return NextResponse.json({ ok: false, error: "email", message: "Проверьте адрес почты." }, { status: 400 });
  if (password.length < 8 || password.length > 100)
    return NextResponse.json({ ok: false, error: "password", message: "Пароль должен быть от 8 символов." }, { status: 400 });
  if (!firstName || !regionId)
    return NextResponse.json({ ok: false, error: "bad_request", message: "Заполните имя и регион." }, { status: 400 });

  const { data: reg } = await supabaseAdmin.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (!reg) return NextResponse.json({ ok: false, error: "no_region", message: "Выберите регион." }, { status: 400 });

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created?.user) {
    const exists = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json(
      {
        ok: false,
        error: exists ? "exists" : "create",
        message: exists ? "Такая почта уже зарегистрирована — войдите вместо регистрации." : "Не удалось зарегистрироваться. Попробуйте ещё раз.",
      },
      { status: exists ? 409 : 500 }
    );
  }

  const { error: insErr } = await supabaseAdmin.from("users").insert({
    id: created.user.id,
    first_name: firstName,
    email,
    region_id: regionId,
    role: "viewer",
  });
  if (insErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ ok: false, error: "save", message: "Не удалось сохранить анкету. Попробуйте ещё раз." }, { status: 500 });
  }
  await recordActivity(req, created.user.id, "register");
  return NextResponse.json({ ok: true });
}
