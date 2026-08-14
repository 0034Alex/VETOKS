"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Region = { id: string; name: string; slug: string };

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export default function RegisterPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [telegramUser, setTelegramUser] = useState<{
    id: number;
    first_name?: string;
    username?: string;
  } | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Если открыто внутри Telegram Mini App — считываем данные пользователя.
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser) {
      setTelegramUser(tgUser);
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
    }

    // Загружаем список регионов из базы.
    supabase
      .from("regions")
      .select("id, name, slug")
      .order("name")
      .then(({ data }) => {
        if (data) setRegions(data as Region[]);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRegion) return;

    setStatus("loading");
    setErrorMessage("");

    const { error } = await supabase.from("users").insert({
      telegram_id: telegramUser?.id ?? null,
      first_name: telegramUser?.first_name ?? "Гость",
      username: telegramUser?.username ?? null,
      region_id: selectedRegion,
      role: "viewer",
    });

    if (error) {
      // Пользователь с этим telegram_id уже зарегистрирован — не ошибка для нас.
      if (error.code === "23505") {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(error.message);
      }
    } else {
      setStatus("success");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold text-gold mb-4">
          Добро пожаловать в VETOKS!
        </h1>
        <p className="text-muted">
          Регистрация прошла успешно. Ваш регион сохранён.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-gold mb-2">Регистрация</h1>
      <p className="text-muted mb-8">
        {telegramUser
          ? `Привет, ${telegramUser.first_name}!`
          : "Открыто в браузере (не в Telegram) — тестовый режим."}
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <label className="text-left text-offwhite text-sm">
          Выберите ваш регион
        </label>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
          required
        >
          <option value="" disabled>
            — выберите —
          </option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full hover:bg-goldSoft transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Сохраняем..." : "Продолжить"}
        </button>

        {status === "error" && (
          <p className="text-danger text-sm">{errorMessage}</p>
        )}
      </form>
    </main>
  );
}
