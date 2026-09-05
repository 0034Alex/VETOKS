"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=вс, 1=пн...
  const diff = (day === 0 ? -6 : 1) - day; // сдвиг до понедельника этой недели
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

type RegionParticipant = { id: string; display_name: string; photo_url: string | null };
type LeaderRow = { target_participant_id: string; count: number };

export default function BlackMarkModal({
  myParticipantId,
  myRegionId,
  onClose,
}: {
  myParticipantId: string | null;
  myRegionId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [alreadySentTo, setAlreadySentTo] = useState<string | null>(null);
  const [regionParticipants, setRegionParticipants] = useState<RegionParticipant[]>([]);
  const [leader, setLeader] = useState<(RegionParticipant & { count: number }) | null>(null);
  const [penaltyVotes, setPenaltyVotes] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const weekStart = getWeekStart();

  useEffect(() => {
    (async () => {
      setLoading(true);

      if (myParticipantId) {
        const { data: mySend } = await supabase
          .from("black_marks")
          .select("target_participant_id")
          .eq("sender_participant_id", myParticipantId)
          .eq("week_start", weekStart)
          .maybeSingle();
        setAlreadySentTo(mySend?.target_participant_id ?? null);
      }

      if (myRegionId) {
        const { data: participantsData } = await supabase
          .from("participants")
          .select("id, display_name, photo_url")
          .eq("region_id", myRegionId)
          .eq("is_eliminated", false);
        setRegionParticipants(
          ((participantsData as RegionParticipant[]) ?? []).filter(
            (p) => p.id !== myParticipantId
          )
        );

        const { data: marksData } = await supabase
          .from("black_marks")
          .select("target_participant_id")
          .eq("region_id", myRegionId)
          .eq("week_start", weekStart);
        const counts: Record<string, number> = {};
        (marksData ?? []).forEach((m: { target_participant_id: string }) => {
          counts[m.target_participant_id] = (counts[m.target_participant_id] ?? 0) + 1;
        });
        const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        if (topId) {
          const { data: topParticipant } = await supabase
            .from("participants")
            .select("id, display_name, photo_url")
            .eq("id", topId)
            .maybeSingle();
          if (topParticipant) {
            setLeader({ ...(topParticipant as RegionParticipant), count: counts[topId] });
          }

          const { data: penaltyRow } = await supabase
            .from("black_mark_penalties")
            .select("penalty_votes")
            .eq("participant_id", topId)
            .eq("week_start", weekStart)
            .maybeSingle();
          setPenaltyVotes(penaltyRow?.penalty_votes ?? null);
        }
      }

      setLoading(false);
    })();
  }, [myParticipantId, myRegionId, weekStart]);

  async function sendMark(targetId: string) {
    if (!myParticipantId || !myRegionId || alreadySentTo) return;
    if (!confirm("Отправить чёрную метку этой участнице? Один раз в неделю, отменить нельзя.")) return;
    setSending(true);
    const { error } = await supabase.from("black_marks").insert({
      sender_participant_id: myParticipantId,
      target_participant_id: targetId,
      region_id: myRegionId,
      week_start: weekStart,
    });
    if (error) {
      alert(`Не удалось отправить: ${error.message}`);
      setSending(false);
      return;
    }
    setAlreadySentTo(targetId);
    setSending(false);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="bg-bgSurface border border-danger/50 rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-offwhite font-semibold flex items-center gap-1.5">
            🖤 Чёрная метка недели
          </span>
          <button onClick={onClose} className="text-muted text-xl leading-none">
            ✕
          </button>
        </div>

        {loading && <p className="text-muted text-sm py-4">Загрузка...</p>}

        {!loading && leader && (
          <div className="bg-bgPrimary border border-danger/40 rounded-xl p-4 mb-4 text-center">
            <div className="w-16 h-16 rounded-full bg-black/40 overflow-hidden mx-auto mb-2 border-2 border-danger">
              {leader.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={leader.photo_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <p className="text-offwhite font-semibold text-sm">{leader.display_name}</p>
            <p className="text-danger text-xs mt-1">
              🖤 Чёрных меток на этой неделе: {leader.count}
            </p>
            {penaltyVotes !== null ? (
              <p className="text-muted text-xs mt-1">
                Штраф уже применён: −{penaltyVotes} голосов
              </p>
            ) : (
              <p className="text-muted text-xs mt-1">
                Итоги недели ещё не подведены
              </p>
            )}
          </div>
        )}

        {!loading && !leader && (
          <p className="text-muted text-sm text-center py-3">
            На этой неделе в вашем регионе ещё никто не получил чёрную метку.
          </p>
        )}

        {!loading && myParticipantId && (
          <>
            <div className="border-t border-muted my-3" />
            {alreadySentTo ? (
              <p className="text-muted text-xs text-center">
                Вы уже использовали чёрную метку на этой неделе —{" "}
                {regionParticipants.find((p) => p.id === alreadySentTo)?.display_name ??
                  "выбор сохранён"}
                .
              </p>
            ) : (
              <>
                <p className="text-offwhite text-sm font-semibold mb-2">
                  Отправить чёрную метку сопернице (1 раз в неделю):
                </p>
                <div className="flex flex-col gap-2">
                  {regionParticipants.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => sendMark(p.id)}
                      disabled={sending}
                      className="flex items-center gap-2 bg-bgPrimary border border-muted rounded-lg p-2 text-left disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-full bg-black/40 overflow-hidden flex-shrink-0">
                        {p.photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-offwhite text-sm">{p.display_name}</span>
                    </button>
                  ))}
                  {regionParticipants.length === 0 && (
                    <p className="text-muted text-xs">В вашем регионе больше нет соперниц.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
