"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Winner = { id: string; name: string; photo: string | null; crown: string; region?: string };
type ShowHall = { key: string; title: string; contest: string; status: string; winners: Winner[] };

const CROWN_TITLE: Record<string, Record<string, string>> = {
  miss: { season: "Мисс VETOKS", region: "Мисс региона" },
  talent: { season: "Талант VETOKS", region: "Талант региона" },
};

function titleOf(contest: string, crown: string) {
  return CROWN_TITLE[contest]?.[crown] ?? (crown === "season" ? "Победительница сезона" : "Победительница региона");
}

// Зал славы: общий для всех шоу. У каждого шоу и сезона свой раздел с победительницами.
export default function HallOfFamePage() {
  const [shows, setShows] = useState<ShowHall[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/show/hall", { method: "POST" });
        const r = await res.json();
        if (r?.ok) setShows(r.shows);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 max-w-md mx-auto">
        <h1 className="text-3xl font-semibold text-gold text-center mb-2">🏆 Зал славы</h1>
        <p className="text-muted text-sm text-center mb-6">Победительницы всех шоу VETOKS. Выберите шоу и сезон.</p>

        {loading && <p className="text-muted text-center">Загрузка...</p>}
        {!loading && shows.length === 0 && <p className="text-muted text-center">Пока здесь пусто.</p>}

        <div className="flex flex-col gap-3">
          {shows.map((s) => {
            const isOpen = open === s.key;
            const live = s.status === "live";
            const groups = ["season", "region"].map((c) => ({ crown: c, list: s.winners.filter((w) => w.crown === c) })).filter((g) => g.list.length);
            return (
              <div key={s.key} className="bg-bgSurface border border-gold/40 rounded-2xl overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : s.key)} className="w-full flex items-center gap-3 px-4 py-4 text-left">
                  <span className="text-2xl">{s.contest === "talent" ? "🎭" : "👑"}</span>
                  <span className="flex-1">
                    <span className="block text-offwhite font-semibold">{s.title} · Сезон 1</span>
                    <span className="block text-muted text-xs">{live ? "Идёт сейчас, победительницы после гранд-финала" : "Сезон завершён"}</span>
                  </span>
                  <span className={`text-gold transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-muted/40">
                    {groups.length === 0 && <p className="text-muted text-sm pt-3">Победительницы появятся после гранд-финала.</p>}
                    {groups.map((g) => (
                      <div key={g.crown} className="pt-3">
                        <p className="text-gold text-xs tracking-widest mb-2">{titleOf(s.contest, g.crown).toUpperCase()}</p>
                        <div className="flex flex-col gap-2">
                          {g.list.map((w) => (
                            <Link key={w.id} href={`/participant/${w.id}`} className="flex items-center gap-3 bg-bgPrimary border border-muted/50 rounded-lg px-3 py-2">
                              {w.photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={w.photo} alt={w.name} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-black/40" />
                              )}
                              <span className="flex-1 text-offwhite text-sm">{w.name}</span>
                              {w.region && <span className="text-muted text-xs">{w.region}</span>}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
