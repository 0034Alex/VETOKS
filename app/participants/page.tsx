"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
};

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    const { data: participantsData } = await supabase
      .from("participants")
      .select("id, display_name, bio, photo_url")
      .eq("is_eliminated", false);

    const list = (participantsData as Participant[]) ?? [];
    setParticipants(list);

    if (list.length > 0) {
      const { data: votesData } = await supabase
        .from("votes")
        .select("participant_id");

      const counts: Record<string, number> = {};
      (votesData ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });
      setVoteCounts(counts);
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

    // Находим текущего пользователя (Telegram или тестовый — последний зарегистрированный).
    const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    let voterId: string | null = null;

    if (tgId) {
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", tgId)
        .maybeSingle();
      voterId = data?.id ?? null;
    }
    if (!voterId) {
      const { data } = await supabase
        .from("users")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      voterId = data?.id ?? null;
    }

    if (!voterId) {
      setBusyId(null);
      return;
    }

    await supabase.from("votes").insert({
      voter_id: voterId,
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

  return (
    <main className="min-h-screen px-6 py-12">
      <h1 className="text-3xl font-semibold text-gold mb-2 text-center">
        Участницы
      </h1>
      <p className="text-muted text-center mb-10">
        Голосуйте за свою фаворитку
      </p>

      {loading && <p className="text-muted text-center">Загрузка...</p>}

      {!loading && participants.length === 0 && (
        <p className="text-muted text-center">
          Пока нет одобренных участниц.
        </p>
      )}

      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {participants
          .sort(
            (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0)
          )
          .map((p, index) => (
            <div
              key={p.id}
              className="bg-bgSurface border border-muted rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[3/4] bg-black/40 flex items-center justify-center">
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo_url}
                    alt={p.display_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted text-sm">Нет фото</span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg text-offwhite font-semibold">
                    {index === 0 && voteCounts[p.id] > 0 ? "👑 " : ""}
                    {p.display_name}
                  </h2>
                  <span className="text-gold text-sm font-semibold">
                    {voteCounts[p.id] ?? 0} голосов
                  </span>
                </div>
                {p.bio && (
                  <p className="text-muted text-sm flex-1">{p.bio}</p>
                )}
                <button
                  onClick={() => handleVote(p.id)}
                  disabled={votedIds.includes(p.id) || busyId === p.id}
                  className="bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40 mt-2"
                >
                  {votedIds.includes(p.id) ? "Вы проголосовали" : "Голосовать"}
                </button>
              </div>
            </div>
          ))}
      </div>
    </main>
  );
}
