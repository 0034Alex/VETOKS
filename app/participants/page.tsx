"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  created_at: string;
};

type Filter = "all" | "top" | "new";

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  async function loadData() {
    setLoading(true);

    const { data: participantsData } = await supabase
      .from("participants")
      .select("id, display_name, bio, photo_url, created_at")
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
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
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
    <main className="min-h-screen pb-24">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>

      <div className="px-6 mb-4">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">
          Участницы
        </h1>
        <p className="text-muted text-sm">MISS · {participants.length} анкет</p>
      </div>

      <div className="px-6 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск участницы"
          className="w-full bg-bgSurface text-offwhite border border-muted rounded-full px-5 py-3 text-sm"
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

      <div className="px-6 grid grid-cols-2 gap-3">
        {filtered.map((p, index) => (
          <div
            key={p.id}
            className="bg-bgSurface border border-muted rounded-xl overflow-hidden flex flex-col"
          >
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
            <div className="p-3 flex flex-col gap-1">
              <h2 className="text-sm text-offwhite font-semibold truncate">
                {p.display_name}
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-rose">♥ {voteCounts[p.id] ?? 0}</span>
                <span className="text-gold">
                  🎁 {giftCounts[p.id] ?? 0}
                </span>
              </div>
              <button
                onClick={() => handleVote(p.id)}
                disabled={votedIds.includes(p.id) || busyId === p.id}
                className="mt-1 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-2 rounded-full text-xs disabled:opacity-40"
              >
                {votedIds.includes(p.id) ? "Голос отдан" : "Поддержать"}
              </button>
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

      <BottomNav />
    </main>
  );
}
