"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getDeviceId, getTelegramId } from "@/lib/currentUser";

type Region = { id: string; name: string; slug: string };

export default function RegisterPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser) {
      setIsTelegram(true);
      setFirstName(tgUser.first_name ?? "");
      (window as any).Telegram?.WebApp?.ready?.();
      (window as any).Telegram?.WebApp?.expand?.();
    }

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

    const tgId = getTelegramId();
    const deviceId = getDeviceId();

    const { error } = await supabase.from("users").insert({
      telegram_id: tgId,
      device_id: deviceId,
      first_name: firstName || "Гость",
      region_id: selectedRegion,
      role: "viewer",
    });

    if (error) {
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
        <p className="text-muted mb-8">
          Регистрация прошла успешно. Ваш регион сохранён.
        </p>
        <Link
          href="/"
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full hover:bg-goldSoft transition-colors"
        >
          На главную
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-gold mb-2">Регистрация</h1>
      <p className="text-muted mb-8">
        {isTelegram
          ? `Привет, ${firstName}!`
          : "Открыто в браузере (не в Telegram) — тестовый режим."}
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        {!isTelegram && (
          <div className="flex flex-col gap-1">
            <label className="text-left text-offwhite text-sm">Имя</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
              placeholder="Как вас называть"
            />
          </div>
        )}

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
