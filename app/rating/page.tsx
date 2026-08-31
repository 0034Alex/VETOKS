"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";

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
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [scope, setScope] = useState<"region" | "country">("region");
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [editorsChoice, setEditorsChoice] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  async function loadEditorsChoice() {
    const { data: editorsData } = await supabase
      .from("participants")
      .select("id, display_name, photo_url")
      .eq("is_editors_choice", true)
      .maybeSingle();
    setEditorsChoice((editorsData as Participant) ?? null);
  }

  async function loadParticipantsFor(ids: string[]) {
    if (ids.length === 0) {
      setParticipants({});
      return;
    }
    const { data: pData } = await supabase
      .from("participants")
      .select("id, display_name, photo_url")
      .in("id", ids);
    const map: Record<string, Participant> = {};
    (pData as Participant[] ?? []).forEach((p) => {
      map[p.id] = p;
    });
    setParticipants(map);
  }

  async function loadCountry() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data: rankingsData } = await supabase
      .from("title_rankings")
      .select("title_key, participant_id, metric_value")
      .eq("snapshot_date", today);
    setRankings((rankingsData as Ranking[]) ?? []);
    await loadParticipantsFor(
      [...new Set((rankingsData ?? []).map((r: Ranking) => r.participant_id))]
    );
    await loadEditorsChoice();
    setLoading(false);
  }

  async function loadRegion(regionId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/recalculate-titles?region=${regionId}`);
      const json = await res.json();
      const data: Ranking[] = json.results ?? [];
      setRankings(data);
      await loadParticipantsFor([...new Set(data.map((r) => r.participant_id))]);
    } catch {
      setRankings([]);
    }
    await loadEditorsChoice();
    setLoading(false);
  }

  async function load() {
    if (scope === "region" && me?.region_id) {
      await loadRegion(me.region_id);
    } else {
      await loadCountry();
    }
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setMe(u);
    })();
  }, []);

  useEffect(() => {
    if (me !== null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, scope]);

  async function recalculateNow() {
    setRecalculating(true);
    if (scope === "region" && me?.region_id) {
      await loadRegion(me.region_id);
    } else {
      await fetch("/api/recalculate-titles");
      await loadCountry();
    }
    setRecalculating(false);
  }

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-3xl mx-auto">
      <PageHeader />
      <PromoBannerCarousel />
      <div className="px-6 mb-4">
        <h1 className="text-2xl font-semibold text-gold mb-1">Рейтинг</h1>
        <p className="text-muted text-sm">
          {scope === "region"
            ? "Титулы по вашему региону — считаются сразу, вживую"
            : "Титулы по всей стране — обновляются раз в сутки"}
        </p>
      </div>

      <div className="px-6 mb-4 flex gap-2">
        <button
          onClick={() => setScope("region")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            scope === "region"
              ? "bg-gold text-bgPrimary"
              : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          {me?.regions?.name ?? "Мой регион"}
        </button>
        <button
          onClick={() => setScope("country")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            scope === "country"
              ? "bg-gold text-bgPrimary"
              : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          Вся страна
        </button>
      </div>

      {loading && <p className="text-muted text-center">Загрузка...</p>}

      {!loading && rankings.length === 0 && !editorsChoice && (
        <div className="px-6 text-center">
          <p className="text-muted mb-4">
            {scope === "region"
              ? "В вашем регионе пока нет данных для рейтинга."
              : "Рейтинг ещё не считался сегодня."}
          </p>
          {scope === "country" && (
            <button
              onClick={recalculateNow}
              disabled={recalculating}
              className="bg-gold text-bgPrimary font-semibold px-6 py-3 rounded-full text-sm disabled:opacity-50"
            >
              {recalculating ? "Считаем..." : "Посчитать сейчас"}
            </button>
          )}
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

      </div>

      <BottomNav />
    </main>
  );
}
