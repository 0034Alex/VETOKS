"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";

// Замените на юзернейм вашего Telegram-бота (без @).
const BOT_USERNAME = "your_bot_username";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const value = identifier.trim();
    const isEmail = value.includes("@");

    const { data: userRow } = await supabase
      .from("users")
      .select("id, email")
      .eq(isEmail ? "email" : "phone", value)
      .maybeSingle();

    if (!userRow) {
      setError("Аккаунт с такими данными не найден.");
      setLoading(false);
      return;
    }

    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("password_reset_codes").insert({
      user_id: userRow.id,
      email: userRow.email,
      code: newCode,
      expires_at: expiresAt,
    });

    if (insertError) {
      setError("Не получилось создать код. Попробуйте ещё раз.");
      setLoading(false);
      return;
    }

    setCode(newCode);
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-gold mb-4">
        Восстановление пароля
      </h1>

      {!code ? (
        <form
          onSubmit={handleRequestCode}
          className="w-full max-w-sm flex flex-col gap-3 text-left"
        >
          <p className="text-muted text-sm mb-2">
            Введите почту или телефон, указанные при регистрации.
          </p>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
          >
            {loading ? "Отправляем..." : "Получить код"}
          </button>
          {error && <p className="text-danger text-sm">{error}</p>}
        </form>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          <p className="text-muted text-sm">Ваш код:</p>
          <p className="text-4xl font-bold text-gold tracking-widest">{code}</p>
          <p className="text-muted text-sm">
            Откройте нашего Telegram-бота и отправьте ему этот код. Бот
            попросит ввести новый пароль — после этого возвращайтесь сюда и
            входите с новым паролем. Код действует 10 минут.
          </p>
          <a
            href={`https://t.me/${BOT_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-center"
          >
            Открыть бота в Telegram
          </a>
        </div>
      )}
    </main>
  );
}
