"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";

type Season = { id: string; title: string; status: string };

const STATUS_LABELS: Record<string, string> = {
  draft: "Скоро старт",
  registration: "Регистрация открыта",
  week1: "Идёт сейчас",
  week2: "Идёт сейчас",
  week3: "Идёт сейчас",
  final: "Идёт сейчас",
  archived: "Завершён",
};

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seasons")
        .select("id, title, status")
        .order("created_at", { ascending: false });
      setSeasons((data as Season[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen pb-28">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>
      <h1 className="text-2xl font-semibold text-offwhite mb-6 px-6">
        Сезоны
      </h1>

      {loading && <p className="text-muted text-center">Загрузка...</p>}

      <div className="px-6 flex flex-col gap-3">
        {seasons.map((s) => (
          <div
            key={s.id}
            className="bg-bgSurface border border-gold/40 rounded-xl p-4 flex items-center justify-between"
          >
            <span className="text-offwhite font-semibold">{s.title}</span>
            <span className="text-gold text-xs">
              {STATUS_LABELS[s.status] ?? s.status}
            </span>
          </div>
        ))}

        <div className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between opacity-60">
          <span className="text-offwhite font-semibold">VETOKS Kids</span>
          <span className="text-muted text-xs">Скоро</span>
        </div>
        <div className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between opacity-60">
          <span className="text-offwhite font-semibold">Архив прошлых сезонов</span>
          <span className="text-muted text-xs">Пока пусто</span>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
