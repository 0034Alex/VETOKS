"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { msToNextUpdate } from "@/lib/kyiv";
import { getMyCountry } from "@/lib/myCountry";
import { useViewCategory } from "@/lib/viewCategory";
import { viewInfo, rankCat } from "@/lib/viewCategory";
import { CategoryStrip } from "@/components/CategorySwitch";

type Row = {
  rank: number;
  participant_id: string;
  votes: number;
  display_name: string;
  photo_url: string | null;
};

function useCountdownToUpdate() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = msToNextUpdate();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

export default function Top25Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timeLeft = useCountdownToUpdate();
  const vc = useViewCategory();
  const rc = rankCat(vc.view, vc.mine);

  useEffect(() => {
    if (!vc.ready) return;
    (async () => {
      setLoading(true);
      // Таблицу Топ-25 раз в сутки в 00:01 составляет сервер по
      // бесплатным голосам за прошедшие сутки.
      const mc = await getMyCountry();
      let lq = supabase
        .from("top25_daily")
        .select("snapshot_date")
        .eq("age_category", rc)
        .order("snapshot_date", { ascending: false })
        .limit(1);
      if (mc.countryId) lq = lq.eq("country_id", mc.countryId);
      const { data: latest } = await lq.maybeSingle();

      if (!latest?.snapshot_date) {
        setRows([]);
        setLoading(false);
        return;
      }
      setDate(latest.snapshot_date);

      let tq = supabase
        .from("top25_daily")
        .select("rank, participant_id, votes")
        .eq("snapshot_date", latest.snapshot_date)
        .eq("age_category", rc)
        .order("rank");
      if (mc.countryId) tq = tq.eq("country_id", mc.countryId);
      const { data: top } = await tq;
      const list = (top ?? []) as { rank: number; participant_id: string; votes: number }[];

      const ids = list.map((r) => r.participant_id);
      const { data: ps } = ids.length
        ? await supabase.from("participants").select("id, display_name, photo_url").in("id", ids)
        : { data: [] as any[] };
      const map: Record<string, { display_name: string; photo_url: string | null }> = {};
      (ps ?? []).forEach((p: any) => (map[p.id] = p));

      setRows(
        list.map((r) => ({
          ...r,
          display_name: map[r.participant_id]?.display_name ?? "—",
          photo_url: map[r.participant_id]?.photo_url ?? null,
        }))
      );
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vc.ready, rc]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <CategoryStrip />

      <div className="px-6 mb-6 text-center">
        <h1 className="text-2xl font-semibold text-gold mb-2">Топ-25 за сутки · {viewInfo(rc).label}</h1>
        <p className="text-muted text-sm">
          Обновление рейтинга через{" "}
          <span className="text-gold font-mono">{timeLeft}</span>
        </p>
        {date && (
          <p className="text-muted text-xs mt-1">
            Итоги за {date.split("-").reverse().join(".")}
          </p>
        )}
      </div>

      {loading && <LoadingScreen inline />}
      {!loading && rows.length === 0 && (
        <p className="text-muted text-center px-6">
          Итоги ещё не подведены. Топ-25 обновляется каждую ночь в 00:01.
        </p>
      )}

      <div className="max-w-md mx-auto flex flex-col gap-2 px-6">
        {rows.map((r) => (
          <Link
            key={r.participant_id}
            href={`/participant/${r.participant_id}`}
            className="flex items-center gap-3 bg-bgSurface border border-muted rounded-lg px-4 py-3"
          >
            <span className="text-gold font-semibold w-6">{r.rank}</span>
            {r.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photo_url} alt={r.display_name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-black/40" />
            )}
            <span className="text-offwhite flex-1">
              {r.rank === 1 ? "👑 " : ""}
              {r.display_name}
            </span>
            <span className="text-gold text-sm font-semibold">{r.votes}</span>
          </Link>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
