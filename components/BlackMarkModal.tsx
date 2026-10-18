"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { kyivIsSunday, kyivWeekStart } from "@/lib/kyiv";

type RegionParticipant = { id: string; display_name: string; photo_url: string | null };

export default function BlackMarkModal({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState("");
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myRegionId, setMyRegionId] = useState<string | null>(null);
  const [alreadySentTo, setAlreadySentTo] = useState<string | null>(null);
  const [regionParticipants, setRegionParticipants] = useState<RegionParticipant[]>([]);
  const [leader, setLeader] = useState<(RegionParticipant & { count: number }) | null>(null);
  const [penaltyVotes, setPenaltyVotes] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const weekStart = kyivWeekStart();
  const isSunday = kyivIsSunday();

  useEffect(() => {
    (async () => {
      setLoading(true);

      if (!userId) {
        setDebugInfo("Вы не вошли в аккаунт.");
        setLoading(false);
        return;
      }

      // Окно само проверяет, участница ли это и какой у неё регион —
      // не полагаясь на то, что передала родительская страница.
      const { data: myParticipant, error: participantError } = await supabase
        .from("participants")
        .select("id, region_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (participantError) {
        setDebugInfo(`Ошибка проверки анкеты: ${participantError.message}`);
      }

      if (!myParticipant) {
        setDebugInfo(
          "У этого аккаунта не нашлось анкеты участницы — отправлять чёрную метку может только сама участница."
        );
      } else {
        setMyParticipantId(myParticipant.id);
        setMyRegionId(myParticipant.region_id ?? null);

        const { data: mySend } = await supabase
          .from("black_marks")
          .select("target_participant_id")
          .eq("sender_participant_id", myParticipant.id)
          .eq("week_start", weekStart)
          .maybeSingle();
        setAlreadySentTo(mySend?.target_participant_id ?? null);

        if (myParticipant.region_id) {
          const { data: participantsData } = await supabase
            .from("participants")
            .select("id, display_name, photo_url")
            .eq("region_id", myParticipant.region_id)
            .eq("is_eliminated", false);
          setRegionParticipants(
            ((participantsData as RegionParticipant[]) ?? []).filter(
              (p) => p.id !== myParticipant.id
            )
          );
        } else {
          setDebugInfo("У вашей анкеты не указан регион — обратитесь в поддержку.");
        }
      }

      if (myParticipant?.region_id) {
        const { data: marksData } = await supabase
          .from("black_marks")
          .select("target_participant_id")
          .eq("region_id", myParticipant.region_id)
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
  }, [userId, weekStart]);

  async function sendMark(targetId: string) {
    if (!myParticipantId || !myRegionId || alreadySentTo) return;
    if (!confirm("Отправить чёрную метку этой участнице? Один раз в неделю, отменить нельзя. Она не узнает, кто отправил.")) return;
    setSending(true);
    const r = await apiPost("/api/black-marks/send", { targetId });
    if (!r.ok) {
      const text: Record<string, string> = {
        not_sunday: "Метки можно отправлять только в воскресенье (по киевскому времени).",
        need_verify: "Сначала подтвердите номер в Telegram.",
        already_sent: "Вы уже отправили метку на этой неделе.",
        other_region: "Метку можно отправить только участнице своего региона.",
        self: "Себе метку отправить нельзя.",
      };
      alert(text[r.error] ?? "Не удалось отправить. Попробуйте ещё раз.");
      if (r.error === "need_verify") window.dispatchEvent(new Event("vetoks:verify-phone"));
      setSending(false);
      return;
    }
    setAlreadySentTo(targetId);
    setSending(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#151517",
          border: "1px solid rgba(224,58,58,0.5)",
          borderRadius: 16,
          padding: 20,
          width: "100%",
          maxWidth: 384,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
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
                Штраф применится в понедельник в 00:01
              </p>
            )}
          </div>
        )}

        {!loading && !leader && (
          <p className="text-muted text-sm text-center py-3">
            На этой неделе в вашем регионе ещё никто не получил чёрную метку.
          </p>
        )}

        {!loading && !myParticipantId && debugInfo && (
          <p className="text-danger text-xs text-center py-3">{debugInfo}</p>
        )}

        {!loading && myParticipantId && (
          <>
            <div className="border-t border-muted my-3" />
            {!isSunday && !alreadySentTo ? (
              <p className="text-muted text-xs text-center">
                Чёрные метки можно отправлять только по воскресеньям (по
                киевскому времени), одну в неделю и только участницам своего
                региона.
              </p>
            ) : alreadySentTo ? (
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
