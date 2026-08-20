"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";

export default function ApplyPage() {
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setStatus("loading");
    setErrorMessage("");

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      setStatus("error");
      setErrorMessage("Сначала войдите в аккаунт.");
      return;
    }

    // Сезон подбирается автоматически: активный сезон региона пользователя.
    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .eq("region_id", currentUser.region_id)
      .eq("status", "registration")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!season) {
      setStatus("error");
      setErrorMessage(
        "В вашем регионе пока нет открытого сезона для регистрации."
      );
      return;
    }

    const { error } = await supabase.from("applications").insert({
      user_id: currentUser.id,
      season_id: season.id,
      status: "submitted",
      form_data: {
        display_name: displayName,
        age,
        city,
        bio,
        photo_url: photoUrl,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("success");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-28">
        <h1 className="text-3xl font-semibold text-gold mb-4">
          Анкета отправлена!
        </h1>
        <p className="text-muted">
          Модератор рассмотрит вашу заявку и сообщит о решении.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 pb-28">
      <h1 className="text-3xl font-semibold text-gold mb-8 text-center">
        Анкета участницы
      </h1>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-left text-offwhite text-sm">Имя</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-left text-offwhite text-sm">Возраст</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-left text-offwhite text-sm">Город</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-left text-offwhite text-sm">
            Ссылка на фото
          </label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-left text-offwhite text-sm">О себе</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full hover:bg-goldSoft transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Отправляем..." : "Отправить анкету"}
        </button>

        {status === "error" && (
          <p className="text-danger text-sm">{errorMessage}</p>
        )}
      </form>

      <BottomNav />
    </main>
  );
}
