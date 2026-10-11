"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";

type Info = {
  verified: boolean;
  free_total: number;
  free_left: number;
  balance: number;
};

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
  const [info, setInfo] = useState<Info | null>(null);
  const [count, setCount] = useState(1);
  const [voting, setVoting] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadInfo() {
    setLoading(true);
    const r = await apiPost("/api/shop/vote-info");
    if (r.ok) setInfo(r as Info);
    setLoading(false);
  }

  useEffect(() => {
    if (!participantId || !userId) return;
    setDone(null);
    setError("");
    setCount(1);
    loadInfo();
    const onVerified = () => loadInfo();
    window.addEventListener("vetoks:verified", onVerified);
    return () => window.removeEventListener("vetoks:verified", onVerified);
  }, [participantId, userId]);

  const available = info ? info.free_left + info.balance : 0;
  const maxCount = Math.min(100, available);

  async function confirmVote() {
    if (!participantId) return;
    setVoting(true);
    setError("");
    const r = await apiPost("/api/shop/vote", { participantId, count });
    setVoting(false);

    if (r.ok) {
      setDone(count);
      onVoted?.();
      return;
    }
    if (r.error === "need_verify") {
      onClose();
      window.dispatchEvent(new Event("vetoks:verify-phone"));
      return;
    }
    if (r.error === "own") setError("За себя голосовать нельзя.");
    else if (r.error === "not_enough") setError("Не хватает голосов.");
    else if (r.error === "banned") setError("Аккаунт заблокирован.");
    else setError("Не удалось засчитать голос. Попробуйте ещё раз.");
    loadInfo();
  }

  if (!participantId) return null;

  const hasVotes = available > 0;

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

        {!loading && !info && (
          <>
            <p className="text-offwhite text-sm mb-4">
              Не удалось загрузить данные. Войдите и попробуйте ещё раз.
            </p>
            <button onClick={onClose} className="w-full text-muted text-xs py-2">
              Закрыть
            </button>
          </>
        )}

        {!loading && info && done !== null && (
          <>
            <p className="text-success font-semibold mb-4">
              {done === 1 ? "Голос учтён!" : `Голосов учтено: ${done}`}
            </p>
            <button
              onClick={onClose}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm"
            >
              Закрыть
            </button>
          </>
        )}

        {!loading && info && done === null && (
          <>
            {info.verified ? (
              <p className="text-offwhite text-sm mb-1">
                Бесплатные голоса: {info.free_left} из {info.free_total}
              </p>
            ) : (
              <p className="text-offwhite text-sm mb-1">
                Бесплатные {info.free_total} голоса дают после подтверждения
                номера в Telegram.
              </p>
            )}
            <p className="text-gold text-2xl font-bold mb-1">
              Всего доступно: {available}
            </p>
            {info.balance > 0 && (
              <p className="text-muted text-xs mb-3">
                из них купленных: {info.balance}
              </p>
            )}

            {hasVotes && (
              <div className="flex items-center justify-center gap-2 mb-4 mt-3">
                <button
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  className="w-9 h-9 rounded-full bg-bgPrimary border border-muted text-offwhite"
                >
                  −
                </button>
                <span className="text-offwhite font-semibold w-10">{count}</span>
                <button
                  onClick={() => setCount((c) => Math.min(maxCount, c + 1))}
                  className="w-9 h-9 rounded-full bg-bgPrimary border border-muted text-offwhite"
                >
                  +
                </button>
                {maxCount > 1 && (
                  <button
                    onClick={() => setCount(maxCount)}
                    className="text-gold text-xs underline ml-1"
                  >
                    все ({maxCount})
                  </button>
                )}
              </div>
            )}

            {hasVotes && (
              <button
                onClick={confirmVote}
                disabled={voting}
                className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm mb-2 disabled:opacity-50"
              >
                {voting ? "Голосуем..." : count === 1 ? "Проголосовать" : `Проголосовать (${count})`}
              </button>
            )}

            {!info.verified && (
              <button
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new Event("vetoks:verify-phone"));
                }}
                className="w-full bg-bgPrimary border border-gold text-gold font-semibold py-3 rounded-full text-sm mb-2"
              >
                📱 Подтвердить номер
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                router.push("/shop?section=votes");
              }}
              className={`w-full py-3 rounded-full text-sm mb-2 font-semibold ${
                hasVotes
                  ? "border border-muted text-offwhite"
                  : "bg-gold text-bgPrimary"
              }`}
            >
              Купить голоса
            </button>

            {error && <p className="text-danger text-xs mb-2">{error}</p>}
            <button onClick={onClose} className="w-full text-muted text-xs py-2">
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  );
}
