"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import PageHeader from "@/components/PageHeader";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  created_at: string;
  season_id: string;
  region_id: string | null;
};

type Filter = "all" | "top" | "new";

export default function ParticipantsPage() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [scope, setScope] = useState<"region" | "country">("region");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [boostedIds, setBoostedIds] = useState<Set<string>>(new Set());
  const [rankMovement, setRankMovement] = useState<Record<string, number | "new">>({});
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  async function loadData() {
    setLoading(true);

    const { data: participantsData } = await supabase
      .from("participants")
      .select("id, display_name, bio, photo_url, created_at, season_id, region_id")
      .eq("is_eliminated", false);

    const list = (participantsData as Participant[]) ?? [];
    setParticipants(list);

    if (list.length > 0) {
      const { data: votesData } = await supabase
        .from("votes")
        .select("participant_id");

      const vCounts: Record<string, number> = {};
      (votesData ?? []).forEach((v: { participant_id: string }) => {
        vCounts[v.participant_id] = (vCounts[v.participant_id] ?? 0) + 1;
      });
      setVoteCounts(vCounts);

      const { data: giftsData } = await supabase
        .from("gifts")
        .select("participant_id, quantity");

      const gCounts: Record<string, number> = {};
      (giftsData ?? []).forEach(
        (g: { participant_id: string; quantity: number }) => {
          gCounts[g.participant_id] =
            (gCounts[g.participant_id] ?? 0) + (g.quantity ?? 1);
        }
      );
      setGiftCounts(gCounts);

      const { data: followsData } = await supabase
        .from("participant_follows")
        .select("participant_id");
      const fCounts: Record<string, number> = {};
      (followsData ?? []).forEach((f: { participant_id: string }) => {
        fCounts[f.participant_id] = (fCounts[f.participant_id] ?? 0) + 1;
      });
      setFollowerCounts(fCounts);

      const { data: boostsData } = await supabase
        .from("boosts")
        .select("participant_id")
        .eq("boost_type", "rating_bump")
        .gt("ends_at", new Date().toISOString());
      setBoostedIds(
        new Set((boostsData ?? []).map((b: { participant_id: string }) => b.participant_id))
      );

      // Динамика позиции: сравниваем сегодняшний порядок с вчерашним снимком.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const { data: snapshotData } = await supabase
        .from("daily_vote_snapshots")
        .select("participant_id, votes")
        .eq("snapshot_date", yesterdayStr);

      if (snapshotData && snapshotData.length > 0) {
        const yesterdayVotes: Record<string, number> = {};
        snapshotData.forEach((s: { participant_id: string; votes: number }) => {
          yesterdayVotes[s.participant_id] = s.votes;
        });
        const yesterdaySorted = list
          .map((p) => ({ id: p.id, votes: yesterdayVotes[p.id] ?? -1 }))
          .filter((p) => p.votes >= 0)
          .sort((a, b) => b.votes - a.votes);
        const yesterdayRank: Record<string, number> = {};
        yesterdaySorted.forEach((p, i) => {
          yesterdayRank[p.id] = i + 1;
        });

        const todaySorted = [...list].sort(
          (a, b) => (vCounts[b.id] ?? 0) - (vCounts[a.id] ?? 0)
        );
        const movement: Record<string, number | "new"> = {};
        todaySorted.forEach((p, i) => {
          const todayRank = i + 1;
          const prevRank = yesterdayRank[p.id];
          movement[p.id] = prevRank ? prevRank - todayRank : "new";
        });
        setRankMovement(movement);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    getCurrentUser().then(setMe);
    const stored = localStorage.getItem("vetoks_voted_ids");
    if (stored) setVotedIds(JSON.parse(stored));
  }, []);

  async function handleVote(participantId: string) {
    if (votedIds.includes(participantId)) return;
    setBusyId(participantId);

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      setBusyId(null);
      return;
    }

    await supabase.from("votes").insert({
      voter_id: currentUser.id,
      participant_id: participantId,
      weight: 1,
      is_paid: false,
    });

    const updated = [...votedIds, participantId];
    setVotedIds(updated);
    localStorage.setItem("vetoks_voted_ids", JSON.stringify(updated));

    await loadData();
    setBusyId(null);
  }

  const filtered = participants
    .filter((p) =>
      p.display_name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((p) =>
      scope === "country" || !me?.region_id
        ? true
        : p.region_id === me.region_id
    )
    .sort((a, b) => {
      if (filter === "new") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      return (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0);
    });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "top", label: "Топ" },
    { key: "new", label: "Новые" },
  ];

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-5xl mx-auto">
        <PageHeader />

        <div className="px-6 mb-4">
          <h1 className="text-2xl font-semibold text-offwhite mb-1">
            Участницы
          </h1>
          <p className="text-muted text-sm">MISS · {filtered.length} анкет</p>
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

        <div className="px-6 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск участницы"
            className="w-full md:max-w-md bg-bgSurface text-offwhite border border-muted rounded-full px-5 py-3 text-sm"
          />
        </div>

        <div className="px-6 mb-6 flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filter === f.key
                  ? "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
                  : "bg-bgSurface text-muted border border-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-muted text-center">Загрузка...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-muted text-center px-6">Ничего не найдено.</p>
        )}

        <div className="px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((p, index) => (
            <div
              key={p.id}
              className="bg-bgSurface border border-muted rounded-xl overflow-hidden flex flex-col"
            >
              <a href={`/participant/${p.id}`}>
                <div className="aspect-[3/4] bg-black/40 flex items-center justify-center relative">
                  <span
                    className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      index === 0
                        ? "bg-gold text-bgPrimary"
                        : "bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white"
                    }`}
                  >
                    {index === 0 ? "👑" : index + 1}
                  </span>
                  {boostedIds.has(p.id) && (
                    <span className="absolute top-2 right-2 bg-bgPrimary/90 text-gold text-[10px] px-2 py-0.5 rounded-full border border-gold/50">
                      🚀 В топе
                    </span>
                  )}
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt={p.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted text-xs">Нет фото</span>
                  )}
                </div>
                <div className="px-3 pt-3">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm text-offwhite font-semibold truncate">
                      {p.display_name}
                    </h2>
                    {rankMovement[p.id] === "new" && (
                      <span className="text-[9px] bg-gold text-bgPrimary px-1.5 py-0.5 rounded-full font-semibold">
                        NEW
                      </span>
                    )}
                    {typeof rankMovement[p.id] === "number" &&
                      (rankMovement[p.id] as number) > 0 && (
                        <span className="text-[10px] text-success">
                          ↑{rankMovement[p.id]}
                        </span>
                      )}
                    {typeof rankMovement[p.id] === "number" &&
                      (rankMovement[p.id] as number) < 0 && (
                        <span className="text-[10px] text-danger">
                          ↓{Math.abs(rankMovement[p.id] as number)}
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className="text-rose">♥ {voteCounts[p.id] ?? 0}</span>
                    <span className="text-gold">
                      🎁 {giftCounts[p.id] ?? 0}
                    </span>
                    <span className="text-muted">
                      👥 {followerCounts[p.id] ?? 0}
                    </span>
                  </div>
                </div>
              </a>
              <div className="p-3 pt-2">
                <button
                  onClick={() => handleVote(p.id)}
                  disabled={votedIds.includes(p.id) || busyId === p.id}
                  className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-2 rounded-full text-xs disabled:opacity-40"
                >
                  {votedIds.includes(p.id) ? "Голос отдан" : "Поддержать"}
                </button>
                <a
                  href={`/shop?participant=${p.id}&name=${encodeURIComponent(p.display_name)}`}
                  className="block mt-2 bg-bgPrimary border border-gold text-gold font-semibold py-2 rounded-full text-xs text-center"
                >
                  🎁 Подарить
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-6 mt-8 bg-bgSurface border border-gold/40 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-offwhite text-sm font-semibold">
              Хочешь попасть в топ?
            </p>
            <p className="text-muted text-xs">
              Получай больше голосов от своих поклонников
            </p>
          </div>
          <span className="text-gold text-xl">👑</span>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
