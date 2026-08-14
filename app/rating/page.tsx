"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Row = { id: string; display_name: string; votes: number };

export default function RatingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: participants } = await supabase
        .from("participants")
        .select("id, display_name")
        .eq("is_eliminated", false);

      const { data: votes } = await supabase.from("votes").select("participant_id");

      const counts: Record<string, number> = {};
      (votes ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });

      const list = (participants ?? []).map((p: { id: string; display_name: string }) => ({
        id: p.id,
        display_name: p.display_name,
        votes: counts[p.id] ?? 0,
      }));

      list.sort((a, b) => b.votes - a.votes);
      setRows(list);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen px-6 py-12 pb-24">
      <h1 className="text-3xl font-semibold text-gold mb-8 text-center">
        Рейтинг
      </h1>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-muted text-center">Пока нет данных.</p>
      )}

      <div className="max-w-md mx-auto flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center justify-between bg-bgSurface border border-muted rounded-lg px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-gold font-semibold w-6">{i + 1}</span>
              <span className="text-offwhite">
                {i === 0 ? "👑 " : ""}
                {r.display_name}
              </span>
            </div>
            <span className="text-gold text-sm font-semibold">
              {r.votes} голосов
            </span>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
