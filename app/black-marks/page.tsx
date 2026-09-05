"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

type Sender = { display_name: string | null };

export default function BlackMarksReceivedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [penalty, setPenalty] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/black-marks");
        return;
      }
      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!p) {
        setIsParticipant(false);
        setLoading(false);
        return;
      }
      setIsParticipant(true);
      const weekStart = getWeekStart();

      const { data: marksData } = await supabase
        .from("black_marks")
        .select("participants!black_marks_sender_participant_id_fkey(display_name)")
        .eq("target_participant_id", p.id)
        .eq("week_start", weekStart);
      setSenders(
        ((marksData as any[]) ?? []).map((m) => ({
          display_name: m.participants?.display_name ?? null,
        }))
      );

      const { data: penaltyRow } = await supabase
        .from("black_mark_penalties")
        .select("penalty_votes")
        .eq("participant_id", p.id)
        .eq("week_start", weekStart)
        .maybeSingle();
      setPenalty(penaltyRow?.penalty_votes ?? null);

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!isParticipant) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <p className="text-muted max-w-sm">Этот раздел доступен только участницам.</p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-2xl mx-auto px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">
          🖤 Чёрные метки на этой неделе
        </h1>
        <p className="text-muted text-sm mb-6">
          Видно только вам
        </p>

        <div className="bg-bgSurface border border-danger/40 rounded-xl p-4 mb-6 text-center">
          <p className="text-danger text-3xl font-bold">{senders.length}</p>
          <p className="text-muted text-xs mt-1">
            {senders.length === 0
              ? "Пока никто не отправил вам чёрную метку"
              : "получено меток на этой неделе"}
          </p>
          {penalty !== null && (
            <p className="text-danger text-sm mt-2">
              Штраф уже применён: −{penalty} голосов
            </p>
          )}
        </div>

        {senders.length > 0 && (
          <div className="flex flex-col gap-2">
            {senders.map((s, i) => (
              <div key={i} className="bg-bgSurface border border-muted rounded-xl p-3">
                <p className="text-offwhite text-sm">{s.display_name ?? "Участница"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
