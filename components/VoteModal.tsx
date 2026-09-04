"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const FREE_VOTES_TOTAL = 3;

export default function VoteModal({
  participantId,
  userId,
  onClose,
  onVoted,
}: {
  participantId: string | null;
  userId: string | null;
  onClose: () => void;
  onVoted?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [freeRemaining, setFreeRemaining] = useState(0);
  const [purchasedBalance, setPurchasedBalance] = useState(0);
  const [voting, setVoting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!participantId || !userId) return;
    (async () => {
      setLoading(true);
      setDone(false);

      const { data: usageRow, error: usageError } = await supabase
        .from("free_vote_usage")
        .select("used_count")
        .eq("user_id", userId)
        .maybeSingle();
      if (usageError) console.error("[VoteModal] free_vote_usage read error:", usageError);
      setFreeRemaining(Math.max(0, FREE_VOTES_TOTAL - (usageRow?.used_count ?? 0)));

      const { data: creditsRow, error: creditsError } = await supabase
        .from("vote_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      if (creditsError) console.error("[VoteModal] vote_credits read error:", creditsError);
      setPurchasedBalance(creditsRow?.balance ?? 0);

      setLoading(false);
    })();
  }, [participantId, userId]);

  async function confirmVote() {
    if (!participantId || !userId) return;
    setVoting(true);
    const usingFree = freeRemaining > 0;

    const { error: voteError } = await supabase.from("votes").insert({
      voter_id: userId,
      participant_id: participantId,
      weight: 1,
      is_paid: !usingFree,
    });
    if (voteError) {
      console.error("[VoteModal] vote insert error:", voteError);
      alert(`Не удалось засчитать голос: ${voteError.message}`);
      setVoting(false);
      return;
    }

    if (usingFree) {
      const { data: usageRow } = await supabase
        .from("free_vote_usage")
        .select("used_count")
        .eq("user_id", userId)
        .maybeSingle();
      const { error: usageUpdateError } = await supabase
        .from("free_vote_usage")
        .upsert(
          { user_id: userId, used_count: (usageRow?.used_count ?? 0) + 1 },
          { onConflict: "user_id" }
        );
      if (usageUpdateError) {
        console.error("[VoteModal] free_vote_usage upsert error:", usageUpdateError);
      }
    } else {
      const { error: balanceUpdateError } = await supabase
        .from("vote_credits")
        .upsert(
          { user_id: userId, balance: Math.max(0, purchasedBalance - 1) },
          { onConflict: "user_id" }
        );
      if (balanceUpdateError) {
        console.error("[VoteModal] vote_credits upsert error:", balanceUpdateError);
      }
    }

    setVoting(false);
    setDone(true);
    onVoted?.();
  }

  if (!participantId) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="bg-bgSurface border border-gold/40 rounded-2xl p-6 w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">🗳️</div>

        {loading && <p className="text-muted text-sm py-4">Загрузка...</p>}

        {!loading && done && (
          <>
            <p className="text-success font-semibold mb-4">Голос учтён!</p>
            <button
              onClick={onClose}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm"
            >
              Закрыть
            </button>
          </>
        )}

        {!loading && !done && freeRemaining > 0 && (
          <>
            <p className="text-offwhite text-sm mb-1">
              У вас есть бесплатные голоса
            </p>
            <p className="text-gold text-2xl font-bold mb-4">
              Осталось {freeRemaining} из {FREE_VOTES_TOTAL}
            </p>
            <button
              onClick={confirmVote}
              disabled={voting}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm mb-2 disabled:opacity-50"
            >
              {voting ? "Голосуем..." : "Проголосовать"}
            </button>
            <button onClick={onClose} className="w-full text-muted text-xs py-2">
              Закрыть
            </button>
          </>
        )}

        {!loading && !done && freeRemaining === 0 && purchasedBalance > 0 && (
          <>
            <p className="text-offwhite text-sm mb-1">Бесплатные голоса закончились</p>
            <p className="text-gold text-2xl font-bold mb-4">
              У вас {purchasedBalance} купленных голосов
            </p>
            <button
              onClick={confirmVote}
              disabled={voting}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm mb-2 disabled:opacity-50"
            >
              {voting ? "Голосуем..." : "Проголосовать"}
            </button>
            <button onClick={onClose} className="w-full text-muted text-xs py-2">
              Закрыть
            </button>
          </>
        )}

        {!loading && !done && freeRemaining === 0 && purchasedBalance === 0 && (
          <>
            <p className="text-offwhite text-sm mb-1">У вас нет голосов</p>
            <p className="text-muted text-xs mb-4">
              Бесплатные 3 голоса уже использованы — можно купить ещё.
            </p>
            <button
              onClick={() => {
                onClose();
                router.push("/shop?section=votes");
              }}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm mb-2"
            >
              Перейти купить голоса
            </button>
            <button onClick={onClose} className="w-full text-muted text-xs py-2">
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  );
}
