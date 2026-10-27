"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import LoadingScreen from "@/components/LoadingScreen";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCurrentUser } from "@/lib/currentUser";
import { getMyCountry } from "@/lib/myCountry";
import { useViewCategory, rankCat } from "@/lib/viewCategory";
import type { ActiveShow } from "@/lib/useShow";

type Row = { rank: number; participant_id: string; votes: number; display_name: string; photo_url: string | null };
type Fol = { id: string; name: string; photo: string | null };

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
  const [folls, setFolls] = useState<Fol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vc.ready) return;
    (async () => {
      const mc = await getMyCountry();
      const r = await apiPost("/api/top25", { cat: rc, countryId: mc.countryId });
      if (r?.ok) setRows(r.rows as Row[]);
      setLoading(false);
    })();
  }, [vc.ready, rc]);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) return;
      const { data } = await supabase
        .from("participant_follows")
        .select("participant_id, participants(display_name, photo_url)")
        .eq("user_id", u.id)
        .limit(30);
      setFolls(
        ((data as any[]) ?? []).map((f) => {
          const p = Array.isArray(f.participants) ? f.participants[0] : f.participants;
          return { id: f.participant_id, name: p?.display_name ?? "", photo: p?.photo_url ?? null };
        })
      );
    })();
  }, []);

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

        {/* Баннер */}
        <div className="mb-5">
          <PromoBannerCarousel
            fallback={
              <div
                className="mx-6 rounded-2xl p-5 border border-gold/30"
                style={{
                  background:
                    "radial-gradient(120% 90% at 85% 0%, rgb(var(--c-sec) / 0.5), transparent 60%), linear-gradient(160deg, rgb(var(--c-surface)), rgb(var(--c-bg)))",
                }}
              >
                <p className="text-goldSoft text-xs tracking-widest mb-1">СЕЗОН 1</p>
                <p className="text-offwhite text-2xl font-bold leading-tight">{show.title}</p>
                <p className="text-muted text-xs mt-1">Сцена. Голос. Победа.</p>
              </div>
            }
          />
        </div>

        {/* Истории: только те, на кого вы подписаны */}
        <div className="px-6 mb-5">
          <p className="text-offwhite text-sm font-semibold mb-2">Истории</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            <div className="flex-none w-16 text-center">
              <div className="w-16 h-16 rounded-full border border-dashed border-gold/70 flex items-center justify-center text-gold text-2xl">+</div>
              <p className="text-[10px] text-muted mt-1">Ваша</p>
            </div>
            {folls.map((f) => (
              <Link key={f.id} href={`/participant/${f.id}`} className="flex-none w-16 text-center">
                <div className="w-16 h-16 rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, rgb(var(--c-sec)), rgb(var(--c-gold)))" }}>
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-bgPrimary">
                    <Avatar photo={f.photo} name={f.name} cls="w-full h-full" />
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-1 truncate">{f.name}</p>
              </Link>
            ))}
            {folls.length === 0 && <p className="text-muted text-xs self-center">Подпишитесь на участниц, и их истории появятся здесь.</p>}
          </div>
        </div>

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
