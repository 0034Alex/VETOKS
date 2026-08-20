"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Ranking = {
  title_key: string;
  participant_id: string;
  metric_value: number;
};

type Participant = { id: string; display_name: string; photo_url: string | null };

const TITLES: { key: string; label: string; unit: string }[] = [
  { key: "miss_season", label: "👑 Мисс сезона", unit: "голосов" },
  { key: "vice_miss", label: "🥈 Вице-мисс", unit: "голосов" },
  { key: "audience_choice", label: "💕 Мисс зрительских симпатий сегодня", unit: "голосов" },
  { key: "gifts_queen", label: "🎁 Мисс по подаркам", unit: "подарков" },
  { key: "followers_queen", label: "👥 Мисс по подписчикам", unit: "подписчиков" },
  { key: "activity_queen", label: "⭐ Мисс активности", unit: "заданий" },
  { key: "chat_queen", label: "💬 Мисс общения", unit: "сообщений" },
  { key: "boost_queen", label: "🚀 Мисс продвижения", unit: "бустов" },
  { key: "rookie", label: "🆕 Открытие сезона", unit: "голосов" },
];

export default function RatingPage() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [editorsChoice, setEditorsChoice] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data: rankingsData } = await supabase
      .from("title_rankings")
      .select("title_key, participant_id, metric_value")
      .eq("snapshot_date", today);
    setRankings((rankingsData as Ranking[]) ?? []);

    const { data: editorsData } = await supabase
      .from("participants")
      .select("id, display_name, photo_url")
      .eq("is_editors_choice", true)
      .maybeSingle();
    setEditorsChoice((editorsData as Participant) ?? null);

    const participantIds = [
      ...new Set((rankingsData ?? []).map((r: Ranking) => r.participant_id)),
    ];
    if (participantIds.length > 0) {
      const { data: pData } = await supabase
        .from("participants")
        .select("id, display_name, photo_url")
        .in("id", participantIds);
      const map: Record<string, Participant> = {};
      (pData as Participant[] ?? []).forEach((p) => {
        map[p.id] = p;
      });
      setParticipants(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function recalculateNow() {
    setRecalculating(true);
    await fetch("/api/recalculate-titles");
    await load();
    setRecalculating(false);
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 mb-6">
        <h1 className="text-2xl font-semibold text-gold mb-1">Рейтинг</h1>
        <p className="text-muted text-sm">
          Титулы обновляются раз в сутки по разным показателям
        </p>
      </div>

      {loading && <p className="text-muted text-center">Загрузка...</p>}

      {!loading && rankings.length === 0 && !editorsChoice && (
        <div className="px-6 text-center">
          <p className="text-muted mb-4">
            Рейтинг ещё не считался сегодня.
          </p>
          <button
            onClick={recalculateNow}
            disabled={recalculating}
            className="bg-gold text-bgPrimary font-semibold px-6 py-3 rounded-full text-sm disabled:opacity-50"
          >
            {recalculating ? "Считаем..." : "Посчитать сейчас"}
          </button>
        </div>
      )}

      <div className="px-6 flex flex-col gap-3">
        {TITLES.map((t) => {
          const ranking = rankings.find((r) => r.title_key === t.key);
          const p = ranking ? participants[ranking.participant_id] : null;
          if (!ranking || !p) return null;
          return (
            <Link
              key={t.key}
              href={`/participant/${p.id}`}
              className="flex items-center gap-3 bg-bgSurface border border-muted rounded-xl p-3"
            >
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_url}
                  alt={p.display_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-black/40" />
              )}
              <div className="flex-1">
                <p className="text-muted text-xs">{t.label}</p>
                <p className="text-offwhite font-semibold">{p.display_name}</p>
              </div>
              <span className="text-gold text-sm font-semibold">
                {ranking.metric_value} {t.unit}
              </span>
            </Link>
          );
        })}

        {editorsChoice && (
          <Link
            href={`/participant/${editorsChoice.id}`}
            className="flex items-center gap-3 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-3"
          >
            {editorsChoice.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={editorsChoice.photo_url}
                alt={editorsChoice.display_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-black/20" />
            )}
            <div className="flex-1">
              <p className="text-white/80 text-xs">🌟 Выбор редакции</p>
              <p className="text-white font-semibold">
                {editorsChoice.display_name}
              </p>
            </div>
          </Link>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
