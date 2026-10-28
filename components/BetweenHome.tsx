"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import BottomNav from "@/components/BottomNav";
import RecruitBanner from "@/components/RecruitBanner";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";
import { apiPost } from "@/lib/authClient";
import { useBetween } from "@/lib/useShow";

type W = { id: string; name: string; photo: string | null; region?: string };

// Главная, когда в стране нет идущего шоу: баннер набора, Зал славы, вопрос недели, реклама.
export default function BetweenHome() {
  const b = useBetween();
  const off = b?.off ?? [];
  const [winners, setWinners] = useState<W[]>([]);
  const [q, setQ] = useState("");
  const [answered, setAnswered] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await apiPost("/api/show/hall", {});
        if (r?.ok) {
          const seen = new Set<string>();
          const list: W[] = [];
          for (const crown of ["season", "region"]) {
            for (const s of [...(r.shows ?? [])].reverse()) {
              for (const w of s.winners ?? []) {
                if (w.crown !== crown || seen.has(w.id)) continue;
                seen.add(w.id);
                list.push({ id: w.id, name: w.name, photo: w.photo, region: w.region });
              }
            }
          }
          setWinners(list.slice(0, 10));
        }
      } catch {}
      try {
        const r = await apiPost("/api/between", {});
        if (r?.ok) {
          setQ(r.question || "");
          setAnswered(!!r.answered);
        }
      } catch {}
    })();
  }, []);

  async function send() {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/between", { action: "answer", text }).catch(() => null);
    setBusy(false);
    if (r?.ok) setAnswered(true);
    else setErr(r?.message || "Не получилось отправить.");
  }

  const first = winners[0];
  return (
    <main className="min-h-screen pb-28">
      <div className="flex justify-center">
        <div className="flex items-center justify-center px-4 py-4 w-full max-w-3xl" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <Logo size={28} />
        </div>
      </div>
      {!off.includes("recruit") && <RecruitBanner />}

      {!off.includes("hall") && (
        <div className="mx-6 mb-4 bg-bgSurface border border-gold/40 rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-gold">🏆 Зал славы</h2>
          <p className="text-muted text-xs mb-3">Победительницы Гранд-финала страны</p>
          {winners.length === 0 ? (
            <p className="text-muted text-sm">Скоро здесь появятся победительницы.</p>
          ) : (
            <>
              {first && (
                <Link href={`/participant/${first.id}`} className="flex items-center gap-3 bg-bgPrimary rounded-xl p-3">
                  <span className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold bg-black/40 flex-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {first.photo && <img src={first.photo} alt="" className="w-full h-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-gold text-xs font-semibold">Главная победительница</span>
                    <span className="block text-offwhite font-semibold truncate">{first.name}</span>
                    {first.region && <span className="block text-muted text-xs truncate">{first.region}</span>}
                  </span>
                </Link>
              )}
              {winners.length > 1 && (
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {winners.slice(1).map((w) => (
                    <Link key={w.id} href={`/participant/${w.id}`} className="text-center min-w-0">
                      <span className="block aspect-square rounded-full overflow-hidden border border-gold/60 bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {w.photo && <img src={w.photo} alt="" className="w-full h-full object-cover" />}
                      </span>
                      <span className="block text-[10px] text-muted truncate mt-1">{w.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
          <Link href="/hall-of-fame" className="block text-center text-gold text-sm border border-gold/50 rounded-full py-2.5 mt-3">
            Смотреть всех
          </Link>
        </div>
      )}

      {!off.includes("question") && q && (
        <div className="mx-6 mb-4 bg-bgSurface border border-muted/40 rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-offwhite">💬 Вопрос недели</h2>
          <p className="text-muted text-sm mt-1">{q}</p>
          {answered ? (
            <p className="text-gold text-sm mt-3">Спасибо, ваш ответ отправлен!</p>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder="Напишите свой ответ..."
                className="w-full bg-bgPrimary text-offwhite border border-muted rounded-xl px-3 py-2 mt-3 text-base min-h-[72px] resize-none"
              />
              {err && <p className="text-danger text-xs mt-1">{err}</p>}
              <button onClick={send} disabled={busy || text.trim().length < 2} className="w-full mt-2 bg-gold text-bgPrimary rounded-full py-2.5 font-semibold text-sm disabled:opacity-50">
                Отправить
              </button>
            </>
          )}
        </div>
      )}

      {!off.includes("ads") && (
        <div className="mb-4">
          <PromoBannerCarousel />
        </div>
      )}
      <BottomNav />
    </main>
  );
}
