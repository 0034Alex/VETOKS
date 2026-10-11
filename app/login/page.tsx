"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getInitData, openSession, postJson } from "@/lib/authClient";
import TelegramLoginButton from "@/components/TelegramLoginButton";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [auto, setAuto] = useState(false);

  // Уже вошли — на главную. Внутри Telegram — входим сами, без ввода.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        router.replace("/");
        return;
      }
      const initData = getInitData();
      if (initData) {
        setAuto(true);
        const r = await postJson("/api/auth/telegram", { initData });
        if (cancelled) return;
        if (r.status === "ok" && (await openSession(r.token_hash))) {
          router.replace("/");
          router.refresh();
          return;
        }
        if (r.status === "new") {
          router.replace("/register");
          return;
        }
        setAuto(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const r = await postJson("/api/auth/password-login", { identifier, password });
    if (r.status !== "ok") {
      setStatus("error");
      setErrorMessage(r.message || "Неверные данные для входа или пароль.");
      return;
    }
    const { error } = await supabase.auth.setSession({
      access_token: r.access_token,
      refresh_token: r.refresh_token,
    });
    if (error) {
      setStatus("error");
      setErrorMessage("Не удалось войти. Попробуйте ещё раз.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (auto) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted text-sm">
        Входим через Telegram...
      </main>
    );
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

      <div className="w-full max-w-sm flex flex-col gap-3 text-left">
        <TelegramLoginButton />

        <p className="text-muted text-xs text-center my-1">или по почте / номеру</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-offwhite text-sm">
              Почта или подтверждённый номер
            </label>
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

          <Link
            href="/forgot-password"
            className="text-gold underline text-xs text-right -mt-1"
          >
            Забыли пароль?
          </Link>

          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full mt-2 disabled:opacity-50"
          >
            {status === "loading" ? "Входим..." : "Войти"}
          </button>

          {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
        </form>
      </div>
    </main>
  );
}
