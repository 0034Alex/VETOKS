"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  user_id: string;
};

export default function ParticipantProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [giftTotal, setGiftTotal] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);

    const { data: p } = await supabase
      .from("participants")
      .select("id, display_name, bio, photo_url, user_id")
      .eq("id", id)
      .maybeSingle();
    setParticipant(p as Participant | null);

    const { count: votes } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", id);
    setVoteCount(votes ?? 0);

    const { data: giftsData } = await supabase
      .from("gifts")
      .select("quantity, total_price")
      .eq("participant_id", id);
    setGiftCount(
      (giftsData ?? []).reduce(
        (sum: number, g: { quantity: number }) => sum + (g.quantity ?? 1),
        0
      )
    );
    setGiftTotal(
      (giftsData ?? []).reduce(
        (sum: number, g: { total_price: number }) => sum + Number(g.total_price),
        0
      )
    );

    const { count: followers } = await supabase
      .from("participant_follows")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", id);
    setFollowerCount(followers ?? 0);

    const u = await getCurrentUser();
    if (u) {
      setUserId(u.id);

      const votedIds = JSON.parse(
        localStorage.getItem("vetoks_voted_ids") ?? "[]"
      );
      setHasVoted(votedIds.includes(id));

      const { data: followRow } = await supabase
        .from("participant_follows")
        .select("id")
        .eq("participant_id", id)
        .eq("user_id", u.id)
        .maybeSingle();
      setIsFollowing(!!followRow);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function handleVote() {
    if (!userId || hasVoted) return;
    setBusy(true);
    await supabase.from("votes").insert({
      voter_id: userId,
      participant_id: id,
      weight: 1,
      is_paid: false,
    });
    const votedIds = JSON.parse(
      localStorage.getItem("vetoks_voted_ids") ?? "[]"
    );
    localStorage.setItem(
      "vetoks_voted_ids",
      JSON.stringify([...votedIds, id])
    );
    await load();
    setBusy(false);
  }

  async function toggleFollow() {
    if (!userId) return;
    setBusy(true);
    if (isFollowing) {
      await supabase
        .from("participant_follows")
        .delete()
        .eq("participant_id", id)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("participant_follows")
        .insert({ participant_id: id, user_id: userId });
    }
    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!participant) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Участница не найдена.
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>

      <div className="max-w-md mx-auto">
        <div className="aspect-[3/4] bg-black/40 rounded-2xl mx-6 overflow-hidden mb-4">
          {participant.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={participant.photo_url}
              alt={participant.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">
              Нет фото
            </div>
          )}
        </div>

        <div className="px-6">
          <h1 className="text-2xl text-offwhite font-semibold mb-2">
            {participant.display_name}
          </h1>

          <div className="flex gap-4 text-sm mb-4">
            <span className="text-rose">♥ {voteCount} голосов</span>
            <span className="text-gold">🎁 {giftCount} подарков</span>
            <span className="text-muted">👥 {followerCount} подписчиков</span>
          </div>

          {participant.bio && (
            <p className="text-offwhite text-sm mb-6">{participant.bio}</p>
          )}

          {userId === participant.user_id && giftTotal > 0 && (
            <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4">
              <p className="text-muted text-xs mb-1">Ваш заработок с подарков (видно только вам)</p>
              <p className="text-gold text-xl font-semibold">{giftTotal} ₽</p>
            </div>
          )}

          <div className="flex gap-3 mb-3">
            <button
              onClick={handleVote}
              disabled={hasVoted || busy || !userId}
              className="flex-1 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-3 rounded-full text-sm disabled:opacity-40"
            >
              {hasVoted ? "Голос отдан" : "Поддержать"}
            </button>
            <Link
              href={`/shop?participant=${participant.id}&name=${encodeURIComponent(
                participant.display_name
              )}`}
              className="flex-1 bg-bgPrimary border border-gold text-gold font-semibold py-3 rounded-full text-sm text-center"
            >
              🎁 Подарить
            </Link>
          </div>

          <button
            onClick={toggleFollow}
            disabled={busy || !userId}
            className={`w-full border font-semibold py-3 rounded-full text-sm disabled:opacity-40 ${
              isFollowing
                ? "border-muted text-muted"
                : "border-gold text-gold"
            }`}
          >
            {isFollowing ? "Вы подписаны" : "Подписаться"}
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
