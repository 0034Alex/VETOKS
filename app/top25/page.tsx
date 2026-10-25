"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
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

export default function Top25Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const vc = useViewCategory();
  const rc = rankCat(vc.view, vc.mine);

  useEffect(() => {
    if (!vc.ready) return;
    (async () => {
      setLoading(true);
      const mc = await getMyCountry();
      const r = await apiPost("/api/top25", { cat: rc, countryId: mc.countryId });
      if (r?.ok) {
        setRows(r.rows as Row[]);
        setDate(r.updatedAt);
      }
      setLoading(false);
    })();
    const timer = setInterval(async () => {
      const mc = await getMyCountry();
      const r = await apiPost("/api/top25", { cat: rc, countryId: mc.countryId });
      if (r?.ok) { setRows(r.rows as Row[]); setDate(r.updatedAt); }
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vc.ready, rc]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <CategoryStrip />

      <div className="px-6 mb-6 text-center">
        <h1 className="text-2xl font-semibold text-gold mb-2">Топ-25 за 24 часа · {viewInfo(rc).label}</h1>
        <p className="text-muted text-sm">Бесплатные голоса за последние 24 часа. Таблица обновляется каждую минуту.</p>
        {date && (
          <p className="text-muted text-xs mt-1">
            Обновлено в {new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {loading && <LoadingScreen inline />}
      {!loading && rows.length === 0 && (
        <p className="text-muted text-center px-6">
          В категории {viewInfo(rc).label} за последние 24 часа пока никто не набрал голосов. Проголосуйте за любимую участницу — и она появится здесь.
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
