"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import LoadingScreen from "@/components/LoadingScreen";
import { apiPost } from "@/lib/authClient";
import { getMyCountry } from "@/lib/myCountry";
import { useViewCategory, rankCat } from "@/lib/viewCategory";
import type { ActiveShow } from "@/lib/useShow";

type Row = { rank: number; participant_id: string; votes: number; display_name: string; photo_url: string | null };

const GENRES = ["Вокал", "Танцы", "Музыка", "Юмор", "Шоу", "Другое"];
const GIFTS = [
  ["🎤", "Микрофон"],
  ["👏", "Овации"],
  ["🎸", "Гитара"],
  ["🔦", "Прожектор"],
  ["🎹", "Рояль"],
  ["🏆", "Гран-при"],
];

function Soon() {
  return <span className="text-[9px] tracking-widest font-bold text-bgPrimary bg-gold rounded-full px-2 py-0.5">СКОРО</span>;
}

function Photo({ r, size }: { r: Row; size: string }) {
  return r.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={r.photo_url} alt={r.display_name} className={`${size} object-cover`} />
  ) : (
    <div className={`${size} bg-bgSurface flex items-center justify-center text-muted text-xl`}>{r.display_name?.[0] ?? "?"}</div>
  );
}

// Главная шоу талантов: другая раскладка, чем у Miss. Сторис и прямые эфиры пока
// показаны макетом (отметка «скоро»), конкурсанты и рейтинг — настоящие.
export default function TalentHome({ show }: { show: NonNullable<ActiveShow> }) {
  const vc = useViewCategory();
  const rc = rankCat(vc.view, vc.mine);
  const [rows, setRows] = useState<Row[]>([]);
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

  const top = rows.slice(0, 3);
  const podium = top.length === 3 ? [top[1], top[0], top[2]] : top;

  return (
    <main className="min-h-screen pb-28 bg-bgPrimary">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between px-6 py-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <Logo size={26} />
          <span className="text-gold text-xs font-semibold border border-gold/50 rounded-full px-3 py-1.5 tracking-wider">ТАЛАНТЫ</span>
        </div>

        {/* Сторис */}
        <div className="px-6 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-offwhite text-sm font-semibold">Истории</p>
            <Soon />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            <div className="flex-none w-16 text-center">
              <div className="w-16 h-16 rounded-full border border-dashed border-gold/70 flex items-center justify-center text-gold text-2xl">+</div>
              <p className="text-[10px] text-muted mt-1">Ваша</p>
            </div>
            {(rows.length ? rows.slice(0, 8) : []).map((r) => (
              <div key={r.participant_id} className="flex-none w-16 text-center">
                <div className="w-16 h-16 rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, rgb(var(--c-sec)), rgb(var(--c-gold)))" }}>
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-bgPrimary">
                    <Photo r={r} size="w-full h-full" />
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-1 truncate">{r.display_name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hero */}
        <div
          className="mx-6 mb-5 rounded-2xl p-5 min-h-[210px] flex flex-col justify-end relative overflow-hidden border border-gold/30"
          style={{
            background:
              "radial-gradient(120% 90% at 85% 0%, rgb(var(--c-sec) / 0.5), transparent 60%), radial-gradient(90% 70% at 0% 100%, rgb(var(--c-gold) / 0.18), transparent 70%), linear-gradient(160deg, rgb(var(--c-surface)), rgb(var(--c-bg)))",
          }}
        >
          <div className="absolute right-3 top-3 text-6xl opacity-20 select-none">🎤</div>
          <p className="text-goldSoft text-xs tracking-widest mb-1">СЕЗОН 1 · ЭТАП 1</p>
          <h1 className="text-3xl font-bold text-offwhite leading-tight mb-1">{show.title}</h1>
          <p className="text-muted text-xs mb-4">Сцена. Голос. Победа.</p>
          <div className="flex gap-2">
            <Link href="/participants" className="flex-1 text-center bg-gold text-bgPrimary rounded-full py-2.5 font-semibold text-xs">
              Голосовать
            </Link>
            <Link href="/media" className="flex-1 text-center bg-bgPrimary/80 border border-gold/50 text-offwhite rounded-full py-2.5 font-semibold text-xs">
              Смотреть выступления
            </Link>
          </div>
        </div>

        {/* Прямой эфир */}
        <div className="mx-6 mb-5 rounded-2xl border border-gold/40 bg-bgSurface p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-2 text-offwhite text-sm font-semibold">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-danger animate-pulse" /> Прямые эфиры
            </p>
            <Soon />
          </div>
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "linear-gradient(90deg, rgb(var(--c-sec) / 0.45), rgb(var(--c-sec2) / 0.25))" }}>
            <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-xl">🎥</div>
            <div className="min-w-0 flex-1">
              <p className="text-offwhite text-sm font-semibold">Отборочный эфир</p>
              <p className="text-muted text-xs">Сегодня в 20:00 · участницы выступают вживую</p>
            </div>
            <span className="text-gold text-xs border border-gold/60 rounded-full px-3 py-1.5 whitespace-nowrap">Напомнить</span>
          </div>
        </div>

        {/* Направления */}
        <div className="px-6 mb-5">
          <p className="text-offwhite text-sm font-semibold mb-2">Направления</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {GENRES.map((g, i) => (
              <span
                key={g}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm border ${i === 0 ? "bg-gold text-bgPrimary border-gold font-semibold" : "bg-bgSurface text-muted border-muted/50"}`}
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Топ-3 */}
        <div className="px-6 mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-offwhite">Лидеры сегодня</h2>
          <Link href="/top25" className="text-gold text-sm">
            Весь Топ-25 ›
          </Link>
        </div>
        {loading && <LoadingScreen inline />}
        {!loading && rows.length === 0 && <p className="text-muted text-center px-6 mb-6 text-sm">Пока никто не набрал голосов.</p>}
        <div className="flex items-end justify-center gap-2 px-4 mb-6">
          {podium.map((r) => {
            const first = r.rank === 1;
            return (
              <Link
                key={r.participant_id}
                href={`/participant/${r.participant_id}`}
                className={`${first ? "w-[36%]" : "w-[30%]"} bg-bgSurface rounded-xl overflow-hidden border ${first ? "border-gold shadow-[0_0_22px_rgb(var(--c-gold)/0.25)]" : "border-muted/40"}`}
              >
                <div className="relative aspect-[3/4] bg-black/40">
                  <span className="absolute top-1.5 left-1.5 text-lg z-10">{r.rank === 1 ? "👑" : r.rank === 2 ? "🥈" : "🥉"}</span>
                  <Photo r={r} size="w-full h-full" />
                </div>
                <div className="px-2 py-2">
                  <p className="text-offwhite text-xs font-semibold truncate">{r.display_name}</p>
                  <p className="text-gold text-[11px]">{r.votes}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Подарки шоу */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-offwhite">Подарки сцены</h2>
            <Link href="/shop" className="text-gold text-sm">
              Все ›
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {GIFTS.map(([ic, n]) => (
              <div key={n} className="bg-bgSurface border border-gold/30 rounded-xl py-3 text-center">
                <div className="text-3xl mb-1">{ic}</div>
                <p className="text-offwhite text-xs">{n}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
