"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Donor = { name: string; amount: number; created_at: string };

export default function GoalDonorsPage() {
  const router = useRouter();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/goal-donors");
        return;
      }

      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!p) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const monday = new Date(now);
      const day = monday.getDay();
      const diff = day === 0 ? 6 : day - 1;
      monday.setDate(monday.getDate() - diff);
      monday.setHours(0, 0, 0, 0);
      const weekStartStr = monday.toISOString().slice(0, 10);

      const { data: contribData } = await supabase
        .from("weekly_goal_contributions")
        .select("amount, user_id, created_at")
        .eq("participant_id", p.id)
        .eq("week_start", weekStartStr)
        .order("created_at", { ascending: false });

      if (contribData && contribData.length > 0) {
        const donorIds = [...new Set(contribData.map((c: { user_id: string }) => c.user_id))];
        const { data: donorUsers } = await supabase
          .from("users")
          .select("id, first_name")
          .in("id", donorIds);
        const nameMap: Record<string, string> = {};
        (donorUsers ?? []).forEach((du: { id: string; first_name: string }) => {
          nameMap[du.id] = du.first_name ?? "Гость";
        });
        setDonors(
          contribData.map((c: { user_id: string; amount: number; created_at: string }) => ({
            name: nameMap[c.user_id] ?? "Гость",
            amount: Number(c.amount),
            created_at: c.created_at,
          }))
        );
      }
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-2 px-6">
        Кто донатил на цель
      </h1>
      <p className="text-muted text-sm mb-6 px-6">
        За эту неделю — видно только вам
      </p>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && donors.length === 0 && (
        <p className="text-muted text-center px-6">
          Пока никто не задонатил на этой неделе.
        </p>
      )}

      <div className="px-6 flex flex-col gap-2">
        {donors.map((d, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-bgSurface border border-muted rounded-lg px-4 py-3"
          >
            <span className="text-offwhite text-sm">{d.name}</span>
            <div className="text-right">
              <p className="text-gold text-sm font-semibold">
                {Math.round(d.amount)} ₽
              </p>
              <p className="text-muted text-xs">
                {new Date(d.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
