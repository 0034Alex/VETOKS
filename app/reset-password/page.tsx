"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [step, setStep] = useState<"start" | "code">("start");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function getTgId(): number | null {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
  }

  async function sendCode() {
    const tgId = getTgId();
    if (!tgId) {
      setErrorMessage(
        "Эта функция работает только внутри приложения в Telegram. Откройте VETOKS через вашего Telegram-бота."
      );
      return;
    }
    setSending(true);
    setErrorMessage("");
    await fetch("/api/request-reset-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: tgId }),
    }).catch(() => null);
    setSending(false);
    setStep("code");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 6) {
      setErrorMessage("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setErrorMessage("Пароли не совпадают.");
      return;
    }

    const tgId = getTgId();
    setStatus("loading");

    const res = await fetch("/api/confirm-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: tgId, code, new_password: newPassword }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json.error ?? "Не удалось сбросить пароль.");
      return;
    }

    setStatus("done");
  }

  if (status === "done") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-gold mb-3">Пароль изменён</h1>
        <p className="text-muted mb-6 text-sm">
          Теперь вы можете войти с новым паролем.
        </p>
        <Link
          href="/login"
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full"
        >
          Войти
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-3xl font-semibold text-gold mb-2">Сброс пароля</h1>
      <p className="text-muted mb-6 text-sm max-w-sm">
        Мы отправим код подтверждения в ваш Telegram — тот самый бот, через
        который вы заходите в приложение.
      </p>

      {step === "start" && (
        <button
          onClick={sendCode}
          disabled={sending}
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full disabled:opacity-50"
        >
          {sending ? "Отправляем..." : "Отправить код в Telegram"}
        </button>
      )}

      {step === "code" && (
        <form
          onSubmit={confirm}
          className="w-full max-w-sm flex flex-col gap-3 text-left"
        >
          <p className="text-success text-sm text-center">
            Код отправлен в Telegram. Проверьте сообщения от бота.
          </p>
          <div>
            <label className="text-offwhite text-sm">Код из Telegram</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
              required
            />
          </div>
          <div>
            <label className="text-offwhite text-sm">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
              required
            />
          </div>
          <div>
            <label className="text-offwhite text-sm">Повторите пароль</label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
              required
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full mt-2 disabled:opacity-50"
          >
            {status === "loading" ? "Сохраняем..." : "Сменить пароль"}
          </button>
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="text-gold text-xs underline self-center"
          >
            Отправить код повторно
          </button>
        </form>
      )}

      {errorMessage && <p className="text-danger text-sm mt-3">{errorMessage}</p>}

      <p className="text-muted text-xs mt-6">
        <Link href="/login" className="text-gold underline">
          Назад ко входу
        </Link>
      </p>
    </main>
  );
}
