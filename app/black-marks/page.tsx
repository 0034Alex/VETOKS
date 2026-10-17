"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { kyivWeekStart } from "@/lib/kyiv";

export default function BlackMarksReceivedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [count, setCount] = useState(0);
  const [penalty, setPenalty] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login");
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
      const weekStart = kyivWeekStart();

      // Только количество. Кто именно отправил метку — не показываем никому.
      const { count: marks } = await supabase
        .from("black_marks")
        .select("id", { count: "exact", head: true })
        .eq("target_participant_id", p.id)
        .eq("week_start", weekStart);
      setCount(marks ?? 0);

      // Штраф за прошедшую неделю (применяется в понедельник в 00:01).
      const { data: penaltyRow } = await supabase
        .from("black_mark_penalties")
        .select("penalty_votes, week_start")
        .eq("participant_id", p.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPenalty(penaltyRow?.penalty_votes ?? null);

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <LoadingScreen />
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
          Видно только вам. Кто отправил метки — скрыто.
        </p>

        <div className="bg-bgSurface border border-danger/40 rounded-xl p-4 mb-6 text-center">
          <p className="text-danger text-3xl font-bold">{count}</p>
          <p className="text-muted text-xs mt-1">
            {count === 0
              ? "Пока никто не отправил вам чёрную метку"
              : "получено меток на этой неделе"}
          </p>
          {penalty !== null && penalty > 0 && (
            <p className="text-danger text-sm mt-2">
              Последний штраф: −{penalty} голосов
            </p>
          )}
        </div>

        <p className="text-muted text-xs">
          Метки можно отправлять только по воскресеньям (по киевскому времени),
          одну в неделю и только участницам своего региона. Штраф получает та,
          у кого за неделю больше всего меток (не меньше двух) — он применяется
          в понедельник в 00:01.
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
