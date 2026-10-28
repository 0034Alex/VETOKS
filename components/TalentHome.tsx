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
import TopCards from "@/components/TopCards";
import ShowPoll from "@/components/ShowPoll";
import RecruitBanner from "@/components/RecruitBanner";
import { apiPost } from "@/lib/authClient";
import { getMyCountry } from "@/lib/myCountry";
import { useViewCategory, rankCat } from "@/lib/viewCategory";
import { applyOpen, hasBlock, type ActiveShow } from "@/lib/useShow";

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
  const ord = (k: string) => {
    const i = (show.blockOrder ?? []).indexOf(k);
    return i < 0 ? 50 : i;
  };
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

        <RecruitBanner />

        <div className="flex flex-col">
        {hasBlock(show, "promo") && (
          <div className="mb-5" style={{ order: ord("promo") }}>
            <PromoBannerCarousel />
          </div>
        )}

        {hasBlock(show, "stories") && <div style={{ order: ord("stories") }}><StoryStrip /></div>}

        {show.launch && (show.launch.tips.length > 0 || show.launch.tasks.length > 0) && (
          <div className="px-6 mb-5" style={{ order: -1 }}>
            <div className="rounded-2xl border border-gold/40 bg-bgSurface p-4">
              <div className="text-[11px] text-muted mb-1">
                {`${show.launch.stage} · день ${show.launch.day} из ${show.launch.total}`}
              </div>
              {show.launch.tips.map((t, i) => (
                <p key={"t" + i} className="text-sm text-offwhite mb-1">💡 {t}</p>
              ))}
              {show.launch.tasks.map((t, i) => (
                <p key={"k" + i} className="text-sm text-gold">✅ {t}</p>
              ))}
            </div>
          </div>
        )}

        {hasBlock(show, "battle") && <div style={{ order: ord("battle") }}><BattleCard contest={show.contest} /></div>}

        {/* Топ-25 */}
        {hasBlock(show, "top") && (
          <div style={{ order: ord("top") }}>
            <div className="px-6 mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-offwhite">Топ-25</h2>
              <Link href="/top25" className="text-gold text-sm">
                Весь ›
              </Link>
            </div>
            {loading ? <LoadingScreen inline /> : <TopCards rows={rows} />}
          </div>
        )}

        {hasBlock(show, "poll") && <div style={{ order: ord("poll") }}><ShowPoll showId={show.id} /></div>}
        </div>

        {applyOpen(show.banner) && (
          <div className="px-6 mt-8">
            <Link href="/apply" className="vt-glow block text-center bg-bgSurface text-gold border border-gold/40 rounded-full py-3.5 font-semibold text-sm">
              Подать анкету
            </Link>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
