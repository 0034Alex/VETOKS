"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    let email = identifier.trim();

    if (!email.includes("@")) {
      // Похоже на телефон — ищем почту по номеру.
      const { data: userRow } = await supabase
        .from("users")
        .select("email")
        .eq("phone", identifier.trim())
        .maybeSingle();

      if (!userRow?.email) {
        setStatus("error");
        setErrorMessage("Аккаунт с таким телефоном не найден.");
        return;
      }
      email = userRow.email;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMessage("Неверные данные для входа или пароль.");
      return;
    }

    router.push(redirectTo);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-gold mb-2">Вход</h1>
      <p className="text-muted mb-6 text-sm">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-gold underline">
          Зарегистрироваться
        </Link>
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-3 text-left"
      >
        <div>
          <label className="text-offwhite text-sm">Почта или телефон</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>
        <div>
          <label className="text-offwhite text-sm">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>

        <Link href="/forgot-password" className="text-gold text-xs text-right">
          Забыли пароль?
        </Link>

        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full mt-2 disabled:opacity-50"
        >
          {status === "loading" ? "Входим..." : "Войти"}
        </button>

        {errorMessage && (
          <p className="text-danger text-sm">{errorMessage}</p>
        )}
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
