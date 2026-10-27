"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";

export type StoryItem = { id: string; kind: "photo" | "video"; url: string; createdAt: string; seen?: boolean; visibility?: string };
export type StoryGroup = { userId: string; name: string; photo: string | null; participantId?: string | null; stories: StoryItem[]; own?: boolean };

const PHOTO_MS = 5000;
const VIS_LABEL: Record<string, string> = { all: "Все", followers: "Подписчики", friends: "Избранные друзья" };

function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} мин` : `${Math.round(m / 60)} ч`;
}

// Полноэкранный просмотр историй: сверху полоски, тап справа/слева листает.
// Свою историю можно удалить, посмотреть кто смотрел, а слева вверху есть «+ Добавить».
export default function StoryViewer({ groups, start, onClose, onChanged }: { groups: StoryGroup[]; start: number; onClose: () => void; onChanged?: () => void }) {
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(0);
  const [prog, setProg] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ name: string; photo: string | null }[] | null>(null);
  const [list, setList] = useState(groups);
  const vref = useRef<HTMLVideoElement>(null);
  const g = list[gi];
  const s = g?.stories[si];

  function next() {
    if (!g) return onClose();
    if (si < g.stories.length - 1) setSi(si + 1);
    else if (gi < list.length - 1) {
      setGi(gi + 1);
      setSi(0);
    } else onClose();
  }
  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(0);
    }
  }

  useEffect(() => {
    setProg(0);
    setViewers(null);
    if (s && !g.own) apiPost("/api/story", { action: "view", id: s.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si]);

  // таймер для фото
  useEffect(() => {
    if (!s || s.kind !== "photo" || paused || viewers) return;
    const t0 = Date.now() - prog * PHOTO_MS;
    const id = setInterval(() => {
      const p = (Date.now() - t0) / PHOTO_MS;
      if (p >= 1) {
        clearInterval(id);
        next();
      } else setProg(p);
    }, 60);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, paused, viewers]);

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    if (paused || viewers) v.pause();
    else v.play().catch(() => {});
  }, [paused, viewers, gi, si]);

  async function remove() {
    if (!s) return;
    await apiPost("/api/story", { action: "delete", id: s.id });
    onChanged?.();
    const left = g.stories.filter((x) => x.id !== s.id);
    if (!left.length) return onClose();
    setList((l) => l.map((x, i) => (i === gi ? { ...x, stories: left } : x)));
    setSi(Math.min(si, left.length - 1));
  }

  async function showViewers() {
    if (!s) return;
    const r = await apiPost("/api/story", { action: "viewers", id: s.id });
    setViewers(r?.ok ? r.items : []);
  }

  if (!g || !s) return null;
  return (
    <div className="fixed inset-0 z-[600] bg-black flex justify-center">
      <div className="relative w-full max-w-md h-full bg-black select-none">
        {s.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.url} alt="" className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <video
            key={s.id}
            ref={vref}
            src={s.url}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProg(v.currentTime / v.duration);
            }}
            onEnded={next}
          />
        )}

        {/* тапы */}
        <div className="absolute inset-0 flex" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
          <div className="w-1/3" onClick={prev} />
          <div className="w-2/3" onClick={next} />
        </div>

        {/* шапка */}
        <div className="absolute top-0 left-0 right-0 px-3 bg-gradient-to-b from-black/70 to-transparent pb-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
          <div className="flex gap-1 mb-3">
            {g.stories.map((x, i) => (
              <div key={x.id} className="flex-1 h-[3px] rounded bg-white/30 overflow-hidden">
                <div className="h-full bg-white" style={{ width: i < si ? "100%" : i === si ? `${Math.min(100, prog * 100)}%` : "0%" }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {g.own && (
              <Link href="/add-video?story=1" className="text-xs font-semibold text-bgPrimary bg-gold rounded-full px-3 py-1.5 whitespace-nowrap">
                + Добавить
              </Link>
            )}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-bgSurface flex-none">
              {g.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.photo} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate">{g.own ? "Ваша история" : g.name}</p>
              <p className="text-white/60 text-[11px]">
                {ago(s.createdAt)}
                {g.own && s.visibility ? ` · ${VIS_LABEL[s.visibility] ?? ""}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-white text-2xl leading-none px-2" aria-label="Закрыть">
              ✕
            </button>
          </div>
        </div>

        {g.own && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 pt-6 bg-gradient-to-t from-black/70 to-transparent" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
            <button onClick={showViewers} className="text-white text-sm">
              👁 Кто смотрел
            </button>
            <button onClick={remove} className="text-danger text-sm">
              Удалить
            </button>
          </div>
        )}

        {viewers && (
          <div className="absolute inset-0 z-10 bg-black/80 flex items-end" onClick={() => setViewers(null)}>
            <div className="w-full max-h-[60%] overflow-y-auto bg-bgSurface rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
              <p className="text-offwhite font-semibold mb-2">Просмотры: {viewers.length}</p>
              {viewers.length === 0 && <p className="text-muted text-sm">Пока никто не смотрел.</p>}
              {viewers.map((v, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-black/40">
                    {v.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.photo} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <span className="text-offwhite text-sm">{v.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
