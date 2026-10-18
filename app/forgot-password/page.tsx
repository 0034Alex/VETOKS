"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import TurnstileBox, { captchaOn } from "@/components/TurnstileBox";

// Сброс пароля: код приходит только владельцу аккаунта в Telegram.
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [step, setStep] = useState<"start" | "code" | "done">("start");
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [capKey, setCapKey] = useState(0);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/request-reset-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), turnstile: captcha }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setLoading(false);
    setCaptcha("");
    setCapKey((k) => k + 1);
    if (res?.status === 429) return setError(json?.message ?? "Слишком много запросов. Повторите позже.");
    if (!res || !res.ok) return setError(json?.error === "captcha" ? json.message : "Не получилось отправить код. Попробуйте ещё раз.");
    setStep("code");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pass.length < 8) return setError("Пароль должен быть не короче 8 символов.");
    if (pass !== pass2) return setError("Пароли не совпадают.");
    setLoading(true);
    const res = await fetch("/api/confirm-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), new_password: pass }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setLoading(false);
    if (!res || !res.ok) return setError(json?.message ?? json?.error ?? "Не удалось сбросить пароль.");
    setStep("done");
  }

  const input = "w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-gold mb-4">Восстановление пароля</h1>

      {step === "start" && (
        <form onSubmit={requestCode} className="w-full max-w-sm flex flex-col gap-3 text-left">
          <p className="text-muted text-sm mb-2">
            Введите почту или номер телефона, указанные при регистрации. Мы отправим код в ваш Telegram.
          </p>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={input} required maxLength={120} />
          <TurnstileBox key={capKey} onToken={setCaptcha} />
          <button type="submit" disabled={loading || (captchaOn && !captcha)} className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50">
            {loading ? "Отправляем..." : "Получить код"}
          </button>
          {error && <p className="text-danger text-sm">{error}</p>}
        </form>
      )}

      {step === "code" && (
        <form onSubmit={confirm} className="w-full max-w-sm flex flex-col gap-3 text-left">
          <p className="text-muted text-sm">
            Если аккаунт найден и привязан к Telegram, бот отправил вам код. Он действует 10 минут. Никому его не сообщайте.
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Код из Telegram" className={input} required maxLength={6} />
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Новый пароль (от 8 символов)" className={input} required maxLength={100} />
          <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Повторите пароль" className={input} required maxLength={100} />
          <button type="submit" disabled={loading} className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50">
            {loading ? "Сохраняем..." : "Сменить пароль"}
          </button>
          {error && <p className="text-danger text-sm">{error}</p>}
        </form>
      )}

      {step === "done" && (
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          <p className="text-success">Пароль изменён.</p>
          <Link href="/login" className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full">
            Войти
          </Link>
        </div>
      )}
    </main>
  );
}
