"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import LoadingScreen from "@/components/LoadingScreen";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
import StoryStrip from "@/components/StoryStrip";
import ShowBanner from "@/components/ShowBanner";
import BattleCard from "@/components/BattleCard";
import { apiPost } from "@/lib/authClient";
import { getMyCountry } from "@/lib/myCountry";
import { useViewCategory, rankCat } from "@/lib/viewCategory";
import type { ActiveShow } from "@/lib/useShow";

type Row = { rank: number; participant_id: string; votes: number; display_name: string; photo_url: string | null };

function Avatar({ photo, name, cls }: { photo: string | null; name: string; cls: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={name} className={`${cls} object-cover`} />
  ) : (
    <div className={`${cls} bg-bgSurface flex items-center justify-center text-muted text-lg`}>{name?.[0] ?? "?"}</div>
  );
}

// Главная шоу талантов: логотип, зал славы, баннер, истории (только тех, на кого вы подписаны), Топ-25.
// Прямые эфиры живут в «Медиа» (вкладка «Эфир»). Подарки шоу — в разделе «Подарки».
export default function TalentHome({ show }: { show: NonNullable<ActiveShow> }) {
  const vc = useViewCategory();
  const rc = rankCat(vc.view, vc.mine);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vc.ready) return;
    (async () => {
      const mc = await getMyCountry();
      const r = await apiPost("/api/top25", { cat: rc, countryId: mc.countryId, contest: show.contest });
      if (r?.ok) setRows(r.rows as Row[]);
      setLoading(false);
    })();
  }, [vc.ready, rc]);

  return (
    <main className="min-h-screen pb-28 bg-bgPrimary">
      <div className="max-w-3xl mx-auto">
        {/* Логотип и зал славы */}
        <div className="flex items-center justify-between px-6 py-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <Logo size={26} />
          <Link href="/hall-of-fame" className="text-gold text-xs font-semibold border border-gold/50 rounded-full px-3 py-1.5 whitespace-nowrap">
            🏆 Зал славы
          </Link>
        </div>

        {/* Главный баннер шоу */}
        <div className="mb-5">
          <ShowBanner show={show} />
        </div>

        <div className="mb-5">
          <PromoBannerCarousel />
        </div>

        <StoryStrip />

        <BattleCard contest={show.contest} />

        {/* Топ-25 */}
        <div className="px-6 mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-offwhite">Топ-25 за 24 часа</h2>
          <Link href="/top25" className="text-gold text-sm">
            Весь ›
          </Link>
        </div>
        {loading && <LoadingScreen inline />}
        {!loading && rows.length === 0 && <p className="text-muted text-center px-6 mb-6 text-sm">Пока никто не набрал голосов.</p>}
        <div className="flex flex-col gap-2 px-6">
          {rows.slice(0, 10).map((r) => (
            <Link
              key={r.participant_id}
              href={`/participant/${r.participant_id}`}
              className={`flex items-center gap-3 bg-bgSurface rounded-lg px-4 py-3 border ${r.rank === 1 ? "border-gold" : "border-muted/50"}`}
            >
              <span className="text-gold font-semibold w-6">{r.rank}</span>
              <Avatar photo={r.photo_url} name={r.display_name} cls="w-9 h-9 rounded-full" />
              <span className="text-offwhite flex-1 truncate">
                {r.rank === 1 ? "👑 " : ""}
                {r.display_name}
              </span>
              <span className="text-gold text-sm font-semibold">{r.votes}</span>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
