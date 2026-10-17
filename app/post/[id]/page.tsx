"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PostRepostTag from "@/components/PostRepostTag";
import { IconRepost } from "@/components/ProfileIcons";

type P = {
  id: string;
  kind: "video" | "photo";
  url: string;
  caption: string;
  createdAt: string;
  views: number;
  ownerUserId: string;
  authorName: string;
  authorSub: string;
  authorPhoto: string | null;
  authorHref: string;
  likes: number;
  liked: boolean;
  comments: number;
  reposted: boolean;
  mine: boolean;
};

type Cm = { id: string; body: string; created_at: string; users: { first_name: string | null } | { first_name: string | null }[] | null };

const Heart = ({ on, size = 24 }: { on: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "#EC4899" : "none"} stroke={on ? "#EC4899" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" />
  </svg>
);
const Bubble = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
  </svg>
);
const Send = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 3 10.5 13.5" />
    <path d="M21.5 3 14.5 21l-4-7.5L3 9.5 21.5 3z" />
  </svg>
);

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const HEADER = "calc(env(safe-area-inset-top) + 52px)";
const NAV = "96px";

// Лента публикаций «Сцена»: каждая публикация на своём экране, листаешь вниз и вверх.
export default function PostFeedPage() {
  const params = useParams();
  const router = useRouter();
  const startId = params.id as string;
  const [items, setItems] = useState<P[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [cur, setCur] = useState(0);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [tagFor, setTagFor] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [cOpen, setCOpen] = useState<string | null>(null);
  const [cList, setCList] = useState<Cm[]>([]);
  const [cText, setCText] = useState("");
  const [muted, setMuted] = useState(true);
  const [pops, setPops] = useState<Record<string, number>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const viewed = useRef<Set<string>>(new Set());
  const scrolled = useRef(false);
  const lastTap = useRef<Record<string, number>>({});
  const tapTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/login?redirect=/post/${startId}`);
        return;
      }
      const qs = new URLSearchParams(window.location.search);
      let u = qs.get("u") || "";
      const tab = qs.get("tab") || "feed";

      if (!u) {
        const one = await apiPost("/api/profile/post", { postId: startId });
        if (!one?.ok) {
          setMissing(true);
          return;
        }
        u = one.post.ownerUserId;
      }
      const c = await apiPost("/api/profile/content", { userId: u });
      let list: { postId: string }[] = [];
      if (c?.ok) list = tab === "video" ? c.videos : tab === "rep" ? c.reposts : tab === "tag" ? c.tags : c.feed;
      let ids = list.map((x) => x.postId);
      if (!ids.includes(startId)) ids = [startId, ...ids];

      const r = await apiPost("/api/profile/posts", { ids });
      if (!r?.ok || !r.items?.length) {
        setMissing(true);
        return;
      }
      const byId: Record<string, P> = {};
      (r.items as P[]).forEach((p) => (byId[p.id] = p));
      const ordered = ids.map((id) => byId[id]).filter(Boolean);
      setItems(ordered);
      setCur(Math.max(0, ordered.findIndex((p) => p.id === startId)));
      setMeId(r.meId as string);
    })();
  }, [startId, router]);

  // Встаём на открытую публикацию.
  useEffect(() => {
    if (!items || scrolled.current) return;
    scrolled.current = true;
    cardRefs.current[startId]?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [items, startId]);

  // Какая публикация сейчас на экране: счётчик, воспроизведение видео, просмотры.
  useEffect(() => {
    if (!items) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const el = e.target as HTMLElement;
          const id = el.dataset.id as string;
          const idx = items.findIndex((p) => p.id === id);
          const v = videoRefs.current[id];
          if (e.isIntersecting) {
            if (idx >= 0) setCur(idx);
            if (v) {
              v.play().catch(() => {});
              if (!viewed.current.has(id)) {
                viewed.current.add(id);
                apiPost("/api/profile/view", { postId: id }).then((r) => {
                  if (r?.ok && typeof r.views === "number") setItems((prev) => prev && prev.map((p) => (p.id === id ? { ...p, views: r.views } : p)));
                });
              }
            }
          } else if (v) v.pause();
        });
      },
      { threshold: 0.6 }
    );
    Object.values(cardRefs.current).forEach((c) => c && obs.observe(c));
    return () => obs.disconnect();
  }, [items]);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2200);
  }

  async function setLike(p: P, on: boolean) {
    if (!meId || p.liked === on) return;
    if (on) await supabase.from("media_likes").insert({ post_id: p.id, user_id: meId });
    else await supabase.from("media_likes").delete().eq("post_id", p.id).eq("user_id", meId);
    setItems((prev) => prev && prev.map((x) => (x.id === p.id ? { ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) } : x)));
  }

  // Один тап по видео — звук, два тапа по любой публикации — лайк.
  function onMediaTap(p: P) {
    const now = Date.now();
    const prev = lastTap.current[p.id] ?? 0;
    if (now - prev < 320) {
      lastTap.current[p.id] = 0;
      clearTimeout(tapTimer.current[p.id]);
      setPops((s) => ({ ...s, [p.id]: (s[p.id] ?? 0) + 1 }));
      setLike(p, true);
      return;
    }
    lastTap.current[p.id] = now;
    if (p.kind === "video") {
      clearTimeout(tapTimer.current[p.id]);
      tapTimer.current[p.id] = setTimeout(() => setMuted((m) => !m), 330);
    }
  }

  async function openComments(id: string) {
    setCOpen(id);
    const { data } = await supabase
      .from("media_comments")
      .select("id, body, created_at, users(first_name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    setCList((data as unknown as Cm[]) ?? []);
  }

  async function sendComment() {
    if (!meId || !cOpen || !cText.trim()) return;
    await supabase.from("media_comments").insert({ post_id: cOpen, user_id: meId, body: cText.trim().slice(0, 500) });
    setCText("");
    setItems((prev) => prev && prev.map((x) => (x.id === cOpen ? { ...x, comments: x.comments + 1 } : x)));
    await openComments(cOpen);
  }

  async function toggleRepost(p: P) {
    const on = !p.reposted;
    const r = await apiPost("/api/profile/repost", { postId: p.id, on });
    if (r?.ok) {
      setItems((prev) => prev && prev.map((x) => (x.id === p.id ? { ...x, reposted: !!r.on } : x)));
      flash(r.on ? "Добавлено на вашу страницу, в «Репосты»" : "Репост убран");
    } else flash("Не получилось. Попробуйте ещё раз.");
  }

  async function report(p: P) {
    setMenuFor(null);
    const r = await apiPost("/api/reports/create", { postId: p.id, reason: "other" });
    flash(r?.ok ? "Жалоба отправлена" : "Не получилось отправить");
  }

  async function share(p: P) {
    const url = `${window.location.origin}/post/${p.id}`;
    if (navigator.share) navigator.share({ title: "VETOKS", url }).catch(() => {});
    else {
      try {
        await navigator.clipboard.writeText(url);
        flash("Ссылка скопирована");
      } catch {
        flash(url);
      }
    }
  }

  if (missing) return <main className="min-h-screen flex items-center justify-center text-muted">Публикация не найдена.</main>;
  if (!items) return <LoadingScreen />;

  const total = items.length;
  // Точки: не больше семи, вокруг текущей.
  const dotStart = Math.max(0, Math.min(cur - 3, total - 7));
  const dots = Array.from({ length: Math.min(7, total) }, (_, k) => dotStart + k);

  return (
    <main className="fixed inset-0 bg-bgPrimary overflow-hidden">
      <style>{`@keyframes vtPop{0%{opacity:0;transform:scale(.4)}25%{opacity:1;transform:scale(1.15)}60%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.1) translateY(-14px)}}`}</style>

      <div
        className="absolute left-0 right-0 top-0 z-30 flex items-center gap-3 px-4 pb-2 bg-bgPrimary/90 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", height: HEADER }}
      >
        <button onClick={() => router.back()} className="text-offwhite text-2xl leading-none" aria-label="Назад">
          ←
        </button>
        <p className="text-offwhite font-semibold flex-1">Публикации</p>
        <span className="text-offwhite/80 text-xs">
          {cur + 1} / {total}
        </span>
        <div className="flex items-center gap-1">
          {dots.map((k) => (
            <i key={k} className={`block h-1.5 rounded-full ${k === cur ? "w-4 bg-goldSoft" : "w-1.5 bg-white/30"}`} />
          ))}
        </div>
      </div>

      <div
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory"
        style={{ paddingTop: HEADER, scrollPaddingTop: HEADER, paddingBottom: NAV }}
      >
        {items.map((p) => (
          <article
            key={p.id}
            data-id={p.id}
            ref={(el) => {
              cardRefs.current[p.id] = el;
            }}
            className="snap-start relative flex flex-col px-4 pt-2 pb-3 overflow-hidden"
            style={{ height: `calc(100dvh - ${HEADER} - ${NAV})` }}
          >
            {/* Размытый фон из самой публикации */}
            <div className="absolute inset-[-20%] z-0 pointer-events-none opacity-70" style={{ filter: "blur(50px) saturate(1.4)" }}>
              {p.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: "radial-gradient(circle at 70% 30%, #EC489966, transparent 55%), linear-gradient(160deg,#2b1b4d,#0e0a18 75%)" }} />
              )}
            </div>

            <div className="relative z-10 flex items-center gap-3 pb-2">
              <Link href={p.authorHref} className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] border border-gold/70 bg-cover bg-center flex-none flex items-center justify-center text-white font-semibold text-sm"
                  style={p.authorPhoto ? { backgroundImage: `url(${p.authorPhoto})` } : undefined}
                >
                  {!p.authorPhoto && (p.authorName || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-offwhite text-sm font-semibold truncate">{p.authorName}</span>
                  {p.authorSub && <span className="block text-offwhite/70 text-xs truncate">{p.authorSub}</span>}
                </span>
              </Link>
              <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="text-offwhite text-2xl leading-none px-2" aria-label="Меню">
                ⋯
              </button>
            </div>
            {menuFor === p.id && (
              <div className="relative z-20 pb-2">
                {p.mine ? (
                  <button
                    onClick={() => {
                      setMenuFor(null);
                      setTagFor(p.id);
                    }}
                    className="text-offwhite text-sm border border-white/40 rounded-full px-4 py-1.5 bg-black/50"
                  >
                    Отметить человека
                  </button>
                ) : (
                  <button onClick={() => report(p)} className="text-danger text-sm border border-danger rounded-full px-4 py-1.5 bg-black/50">
                    Пожаловаться
                  </button>
                )}
              </div>
            )}

            {/* Рамка с фото или видео */}
            <div className="relative z-10 flex-1 min-h-0 rounded-3xl p-[3px]" style={{ background: "linear-gradient(160deg,#E8D48A,#8a6d12 40%,#E8D48A)" }}>
              <div className="relative w-full h-full rounded-[21px] overflow-hidden bg-black select-none" onPointerUp={() => onMediaTap(p)} style={{ touchAction: "manipulation" }}>
                {p.kind === "video" ? (
                  <>
                    <video
                      ref={(el) => {
                        videoRefs.current[p.id] = el;
                      }}
                      src={p.url}
                      loop
                      muted={muted}
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute left-2.5 top-2.5 flex items-center gap-1 bg-black/60 rounded-full pl-2 pr-2.5 py-1 text-[12px] text-white pointer-events-none">
                      ▶ {p.views.toLocaleString("ru-RU")}
                    </span>
                    <span className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-full bg-black/60 text-white text-sm flex items-center justify-center pointer-events-none">
                      {muted ? "🔇" : "🔊"}
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="w-full h-full object-contain pointer-events-none" />
                )}
                {pops[p.id] ? (
                  <span
                    key={pops[p.id]}
                    className="absolute left-1/2 top-1/2 -ml-[46px] -mt-[46px] pointer-events-none"
                    style={{ animation: "vtPop .8s ease-out forwards", opacity: 0 }}
                  >
                    <svg width="92" height="92" viewBox="0 0 24 24" fill="#EC4899" stroke="#EC4899" strokeWidth="1.5" strokeLinejoin="round" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,.5))" }}>
                      <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" />
                    </svg>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Плавающая панель действий */}
            <div className="relative z-20 -mt-5 mx-3 flex items-center justify-between rounded-full bg-black/75 backdrop-blur border border-white/15 px-5 py-2.5 text-offwhite">
              <button onClick={() => setLike(p, !p.liked)} className="flex items-center gap-1.5 text-[13px]" aria-label="Нравится">
                <Heart on={p.liked} size={22} />
                {p.likes}
              </button>
              <button onClick={() => openComments(p.id)} className="flex items-center gap-1.5 text-[13px]" aria-label="Комментарии">
                <Bubble />
                {p.comments}
              </button>
              {!p.mine && (
                <button onClick={() => toggleRepost(p)} className={`flex items-center gap-1.5 text-[13px] ${p.reposted ? "text-goldSoft" : ""}`} aria-label="Репост на мою страницу">
                  <IconRepost size={22} />
                  {p.reposted ? "В репостах" : "Репост"}
                </button>
              )}
              {p.mine && <PostRepostTag postId={p.id} ownerUserId={p.ownerUserId} meId={meId} noButton externalOpen={tagFor === p.id} onExternalClose={() => setTagFor(null)} />}
              <button onClick={() => share(p)} aria-label="Поделиться">
                <Send />
              </button>
            </div>

            <div className="relative z-10 pt-3">
              {p.caption && (
                <p className="text-offwhite text-sm leading-snug line-clamp-2">
                  <b className="mr-1.5">{p.authorName}</b>
                  {p.caption}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-[12px]">
                {p.kind === "video" && <span className="bg-white/15 rounded-full px-2.5 py-1 text-offwhite">▶ {p.views.toLocaleString("ru-RU")} просмотров</span>}
                <span className="bg-white/15 rounded-full px-2.5 py-1 text-offwhite">{fmtDate(p.createdAt)}</span>
                {p.comments > 0 && (
                  <button onClick={() => openComments(p.id)} className="bg-white/15 rounded-full px-2.5 py-1 text-offwhite">
                    Комментарии ({p.comments})
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {cOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setCOpen(null)}>
          <div
            className="bg-bgSurface w-full max-w-md mx-auto max-h-[75vh] rounded-t-2xl p-4 flex flex-col"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-offwhite font-semibold">Комментарии</span>
              <button onClick={() => setCOpen(null)} className="text-muted text-xl" aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex flex-col gap-3 mb-3">
              {cList.length === 0 && <p className="text-muted text-sm text-center py-4">Комментариев пока нет.</p>}
              {cList.map((c) => (
                <p key={c.id} className="text-offwhite text-sm">
                  <b className="mr-1.5">{(Array.isArray(c.users) ? c.users[0]?.first_name : c.users?.first_name) ?? "Гость"}</b>
                  {c.body}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={cText}
                onChange={(e) => setCText(e.target.value)}
                placeholder="Ваш комментарий"
                className="flex-1 bg-bgPrimary text-offwhite border border-muted rounded-full px-4 py-2 text-sm"
              />
              <button onClick={sendComment} className="bg-gold text-bgPrimary font-semibold rounded-full px-4 text-sm">
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">{toast}</div>
      )}
      <BottomNav />
    </main>
  );
}
