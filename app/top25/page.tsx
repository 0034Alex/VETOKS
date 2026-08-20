"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Row = {
  id: string;
  display_name: string;
  photo_url: string | null;
  votes: number;
};

function useCountdownToMidnight() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
          s
        ).padStart(2, "0")}`
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

export default function Top25Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const timeLeft = useCountdownToMidnight();

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { data: participants } = await supabase
        .from("participants")
        .select("id, display_name, photo_url")
        .eq("is_eliminated", false);

      const { data: votes } = await supabase
        .from("votes")
        .select("participant_id")
        .gte("created_at", since.toISOString());

      const counts: Record<string, number> = {};
      (votes ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });

      const list = (participants ?? []).map(
        (p: { id: string; display_name: string; photo_url: string | null }) => ({
          ...p,
          votes: counts[p.id] ?? 0,
        })
      );
      list.sort((a, b) => b.votes - a.votes);
      setRows(list.slice(0, 25));
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen pb-28">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>

      <div className="px-6 mb-6 text-center">
        <h1 className="text-2xl font-semibold text-gold mb-2">
          Топ-25 за сутки
        </h1>
        <p className="text-muted text-sm">
          Обновление рейтинга через{" "}
          <span className="text-gold font-mono">{timeLeft}</span>
        </p>
      </div>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-muted text-center px-6">
          Пока никто не набрал голосов сегодня.
        </p>
      )}

      <div className="max-w-md mx-auto flex flex-col gap-2 px-6">
        {rows.map((r, i) => (
          <Link
            key={r.id}
            href={`/participant/${r.id}`}
            className="flex items-center gap-3 bg-bgSurface border border-muted rounded-lg px-4 py-3"
          >
            <span className="text-gold font-semibold w-6">{i + 1}</span>
            {r.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.photo_url}
                alt={r.display_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-black/40" />
            )}
            <span className="text-offwhite flex-1">
              {i === 0 ? "👑 " : ""}
              {r.display_name}
            </span>
            <span className="text-gold text-sm font-semibold">
              {r.votes}
            </span>
          </Link>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
