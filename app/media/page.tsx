"use client";

import OtherCommentActions from "@/components/OtherCommentActions";
import OwnTextActions from "@/components/OwnTextActions";
import { apiPost } from "@/lib/authClient";
import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import ReportButton from "@/components/ReportButton";
import ShareButton from "@/components/ShareButton";
import { getMyCountry } from "@/lib/myCountry";
import { useViewCategory } from "@/lib/viewCategory";
import { useShow } from "@/lib/useShow";
import { applyContest, cleanContest } from "@/lib/contest";
import {
  IconHeart,
  IconComment,
  IconShare,
  IconCrownVote,
  IconPlusBadge,
  IconSearchWhite,
} from "@/components/Icons";

type Post = {
  id: string;
  video_url: string;
  caption: string | null;
  participant_id: string;
  participants: { age_category?: string; display_name: string; photo_url: string | null; region_id: string | null; season_id: string | null; user_id?: string | null } | null;
};

type Comment = {
  id: string;
  user_id?: string;
  body: string;
  created_at: string;
  users: { first_name: string } | null;
};

type FeedTab = "region" | "following" | "country" | "live";

const PAGE_CATS = ["teen", "main", "adult"];

// Номер устройства для гостей (чтобы «просмотренное» не повторялось и без входа).
function deviceId(): string {
  try {
    let d = localStorage.getItem("vt_device");
    if (!d) {
      d = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem("vt_device", d);
    }
    return d;
  } catch {
    return "";
  }
}

type Ev = { i?: boolean; q?: boolean; c?: boolean };

export default function MediaPage() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [, setVotedIds] = useState<string[]>([]);
  const [, setVoteModalParticipant] = useState<string | null>(null);
  const vc = useViewCategory();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [feedTab, setFeedTab] = useState<FeedTab>("region");
  const { show: curShow } = useShow();
  const liveOn = curShow?.contest === "talent";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  // Звук: браузер разрешает его только после нажатия, поэтому по умолчанию выключен.
  const [soundOn, setSoundOn] = useState(false);
  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    Object.values(videoRefs.current).forEach((v) => {
      if (v) (v as HTMLVideoElement).muted = !next;
    });
  }

  const [noContent, setNoContent] = useState(false);
  const [curIdx, setCurIdx] = useState(0);
  const loadingMore = useRef(false);
  const exhausted = useRef(false);
  const pageNo = useRef(0);
  const allRef = useRef<Post[]>([]);
  const events = useRef<Record<string, Ev>>({});
  const watched = useRef<Record<string, number>>({});
  const visible = useRef<string | null>(null);

  useEffect(() => { allRef.current = allPosts; }, [allPosts]);

  // Следующая порция с сервера: без повторов, с честным стартом новых роликов.
  async function fetchPack(tab: FeedTab, reset: boolean) {
    if (loadingMore.current) return;
    if (!reset && exhausted.current) return;
    loadingMore.current = true;
    try {
      const mc = await getMyCountry();
      const cats = PAGE_CATS.filter((c) => vc.view === "all" || vc.view === c);
      const exclude = reset ? [] : allRef.current.slice(-300).map((x) => x.id);
      const r = await apiPost("/api/media/feed", {
        tab,
        cats,
        exclude,
        device: deviceId(),
        countryId: mc.countryId,
        page: reset ? 0 : pageNo.current,
        contest: cleanContest(curShow?.contest),
      });
      const got: Post[] = (r?.posts as Post[]) ?? [];
      pageNo.current = reset ? 1 : pageNo.current + 1;
      setLikeCounts((prev) => ({ ...prev, ...(r?.likes ?? {}) }));
      setCommentCounts((prev) => ({ ...prev, ...(r?.comments ?? {}) }));
      setLikedIds((prev) => new Set([...prev, ...((r?.liked as string[]) ?? [])]));
      setFollowedIds((prev) => new Set([...prev, ...((r?.followed as string[]) ?? [])]));
      if (!got.length) {
        exhausted.current = tab === "following";
        if (reset && tab !== "following" && r?.ok) setNoContent(true);
      } else {
        setNoContent(false);
      }
      setAllPosts((prev) => {
        const base = reset ? [] : prev;
        const have = new Set(base.map((x) => x.id));
        return [...base, ...got.filter((x) => !have.has(x.id))];
      });
    } finally {
      loadingMore.current = false;
      setLoading(false);
    }
  }

  // Текущий человек (один раз).
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (u) setMe(u);
      const stored = localStorage.getItem("vetoks_voted_ids");
      if (stored) setVotedIds(JSON.parse(stored));
    })();
  }, []);

  // Лента заново при смене вкладки или просматриваемой категории.
  useEffect(() => {
    if (!vc.ready) return;
    exhausted.current = false;
    pageNo.current = 0;
    loadingMore.current = false;
    if (feedTab !== "live") fetchPack(feedTab, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedTab, vc.ready, vc.view, curShow?.contest]);

  // Показы и просмотры отправляем пачкой раз в 20 секунд и при выходе со страницы.
  function flushEvents() {
    const list = (Object.entries(events.current) as [string, Ev][]).map(([p, e]) => ({ p, ...e }));
    if (!list.length) return;
    events.current = {};
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        fetch("/api/media/events", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ device: deviceId(), events: list.slice(0, 40) }),
        }).catch(() => {});
      } catch {}
    })();
  }

  useEffect(() => {
    const t = setInterval(flushEvents, 20000);
    const hide = () => { if (document.visibilityState === "hidden") flushEvents(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flushEvents);
    // раз в секунду копим время просмотра видимого ролика
    const tick = setInterval(() => {
      const pid = visible.current;
      if (!pid || document.visibilityState !== "visible") return;
      const v = videoRefs.current[pid];
      if (!v || v.paused) return;
      watched.current[pid] = (watched.current[pid] ?? 0) + 1000;
      const w = watched.current[pid];
      const ev = (events.current[pid] ??= {});
      if (w >= 1000) ev.i = true;
      if (w >= 10000) ev.q = true;
      if (v.duration && isFinite(v.duration) && w >= Math.min(v.duration, 60) * 900) ev.c = true;
    }, 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", flushEvents);
      flushEvents();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const posts = (() => {
    if (!searchQuery.trim()) return allPosts;
    const q = searchQuery.trim().toLowerCase();
    return allPosts.filter((p) => p.participants?.display_name?.toLowerCase().includes(q));
  })();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pid = (entry.target as HTMLElement).dataset.card || "";
          const video = videoRefs.current[pid];
          if (entry.isIntersecting) {
            video?.play().catch(() => {});
            visible.current = pid;
            const ci = allRef.current.findIndex((x) => x.id === pid);
            if (ci >= 0) setCurIdx(ci);
            // дошли до последних трёх — просим следующую порцию
            const idx = allRef.current.findIndex((x) => x.id === pid);
            if (idx >= 0 && idx >= allRef.current.length - 3) fetchPack(feedTab, false);
          } else {
            video?.pause();
            if (visible.current === pid) visible.current = null;
          }
        });
      },
      { threshold: 0.6 }
    );
    document.querySelectorAll("[data-card]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts, feedTab, curIdx]);

  async function toggleLike(postId: string) {
    if (!me) return;
    if (likedIds.has(postId)) {
      await supabase.from("media_likes").delete().eq("post_id", postId).eq("user_id", me.id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }));
    } else {
      await supabase.from("media_likes").insert({ post_id: postId, user_id: me.id });
      setLikedIds((prev) => new Set(prev).add(postId));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    }
  }

  async function toggleFollow(participantId: string) {
    if (!me) return;
    if (followedIds.has(participantId)) {
      await supabase
        .from("participant_follows")
        .delete()
        .eq("participant_id", participantId)
        .eq("user_id", me.id);
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    } else {
      await supabase
        .from("participant_follows")
        .insert({ participant_id: participantId, user_id: me.id });
      setFollowedIds((prev) => new Set(prev).add(participantId));
    }
  }

  function handleVote(participantId: string) {
    if (!me) return;
    setVoteModalParticipant(participantId);
  }

  async function openCommentsFor(postId: string) {
    setOpenComments(postId);
    const { data } = await supabase
      .from("media_comments")
      .select("id, user_id, body, created_at, edited_at, users(first_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data as unknown as Comment[]) ?? []);
  }

  async function sendComment() {
    if (!me || !openComments || !commentText.trim()) return;
    const rc = await apiPost("/api/comments/send", { postId: openComments, text: commentText });
    if (!rc?.ok) {
      alert(rc?.error === "bad_words" ? "В сообщении есть недопустимые слова. Пожалуйста, перепишите его без грубостей." : "Не получилось отправить. Попробуйте ещё раз.");
      return;
    }
    setCommentText("");
    setCommentCounts((prev) => ({ ...prev, [openComments]: (prev[openComments] ?? 0) + 1 }));
    await openCommentsFor(openComments);
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (noContent && feedTab !== "following" && feedTab !== "live") {
    return <MediaShowcase />;
  }

  return (
    <main className="min-h-screen bg-black flex justify-center">
      <div
        className="h-screen h-[100dvh] w-full max-w-md overflow-y-scroll snap-y snap-mandatory relative"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {/* Верхние вкладки + поиск */}
        <div
          className="fixed top-0 left-0 right-0 z-30 flex justify-center"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="w-full max-w-md px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center gap-4 overflow-x-auto">
              <button
                onClick={() => {
                  setFeedTab("region");
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className={`text-sm whitespace-nowrap ${
                  feedTab === "region" && !searchQuery ? "text-white font-semibold" : "text-white/60"
                }`}
              >
                Рекомендации
              </button>
              <button
                onClick={() => {
                  setFeedTab("following");
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className={`text-sm whitespace-nowrap ${
                  feedTab === "following" && !searchQuery ? "text-white font-semibold" : "text-white/60"
                }`}
              >
                Подписки
              </button>
              <button
                onClick={() => {
                  setFeedTab("country");
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className={`text-sm whitespace-nowrap ${
                  feedTab === "country" && !searchQuery ? "text-white font-semibold" : "text-white/60"
                }`}
              >
                Вся страна
              </button>
              {liveOn && (
                <button
                  onClick={() => {
                    setFeedTab("live");
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className={`text-sm whitespace-nowrap flex items-center gap-1 ${feedTab === "live" ? "text-white font-semibold" : "text-white/60"}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-danger animate-pulse" /> Эфир
                </button>
              )}
            </div>
            <button onClick={() => setSearchOpen((v) => !v)} className="flex-shrink-0 ml-2">
              <IconSearchWhite />
            </button>
          </div>
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 px-4 pb-2 flex justify-center bg-black/70">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Имя участницы..."
                className="w-full max-w-md bg-black/60 text-white border border-white/30 rounded-full px-4 py-2 text-sm"
              />
            </div>
          )}
        </div>

        {feedTab === "live" && (
          <div className="fixed inset-0 z-20 bg-black flex items-center justify-center px-8 text-center">
            <div>
              <p className="text-4xl mb-3">🔴</p>
              <p className="text-white font-semibold mb-1">Прямых эфиров сейчас нет</p>
              <p className="text-muted text-sm">Когда участница выйдет в эфир, он появится здесь с отметкой LIVE.</p>
            </div>
          </div>
        )}

        {posts.length === 0 && (
          <div className="h-screen h-[100dvh] w-full flex items-center justify-center px-8 text-center">
            <p className="text-muted text-sm">
              {searchQuery
                ? "Никого не нашли по этому имени."
                : feedTab === "following"
                ? "Вы пока ни на кого не подписаны."
                : "Пока нет роликов."}
            </p>
          </div>
        )}

        {posts.map((p) => (
          <div
            key={p.id}
            data-card={p.id}
            className="h-screen h-[100dvh] w-full snap-start relative flex items-center justify-center"
          >
            {Math.abs(allPosts.indexOf(p) - curIdx) > 2 ? (
              <div className="w-full h-full bg-black" />
            ) : (
            <video
              ref={(el) => {
                videoRefs.current[p.id] = el;
              }}
              src={p.video_url}
              data-pid={p.id}
              preload="metadata"
              loop
              muted={!soundOn}
              playsInline
              className="w-full h-full object-cover"
            />
            )}

            <button
              onClick={toggleSound}
              aria-label={soundOn ? "Выключить звук" : "Включить звук"}
              className="absolute right-3 top-16 z-20 w-10 h-10 rounded-full bg-black/50 text-white text-lg flex items-center justify-center"
            >
              {soundOn ? "🔊" : "🔇"}
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-4 pb-24 bg-gradient-to-t from-black/90 to-transparent">
              <Link
                href={`/participant/${p.participant_id}`}
                className="flex items-center gap-2 mb-2"
              >
                <div className="w-9 h-9 rounded-full bg-black/40 overflow-hidden border border-gold">
                  {p.participants?.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.participants.photo_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="text-white font-semibold text-sm">
                  {p.participants?.display_name}
                </span>
              </Link>
              {p.caption && (
                <p className="text-white text-sm mb-2">{p.caption}</p>
              )}
            </div>

            {/* Правая колонка — подписка, лайк, комментарии, поделиться, голос */}
            <div className="absolute right-2.5 bottom-28 flex flex-col items-center gap-4">
              <div className="relative mb-1">
                <Link href={`/participant/${p.participant_id}`}>
                  <div className="w-11 h-11 rounded-full bg-black/40 overflow-hidden border-2 border-white">
                    {p.participants?.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.participants.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </Link>
                {!followedIds.has(p.participant_id) && (
                  <button
                    onClick={() => toggleFollow(p.participant_id)}
                    disabled={!me}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[17px] h-[17px] rounded-full bg-danger flex items-center justify-center"
                  >
                    <IconPlusBadge />
                  </button>
                )}
              </div>

              <button onClick={() => toggleLike(p.id)} className="flex flex-col items-center">
                <IconHeart filled={likedIds.has(p.id)} />
                <span className="text-white text-xs mt-0.5">{likeCounts[p.id] ?? 0}</span>
              </button>

              <button onClick={() => openCommentsFor(p.id)} className="flex flex-col items-center">
                <IconComment />
                <span className="text-white text-xs mt-0.5">{commentCounts[p.id] ?? 0}</span>
              </button>

              <ShareButton postId={p.id}>
                <IconShare />
                <span className="text-white text-[10px] mt-0.5">Поделиться</span>
              </ShareButton>

              <ReportButton postId={p.id} loggedIn={!!me} />

              <button
                onClick={() => handleVote(p.participant_id)}
                disabled={!me}
                className="flex flex-col items-center disabled:opacity-50"
              >
                <IconCrownVote />
                <span className="text-white text-[10px] mt-0.5">Голосовать</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {openComments && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end"
          onClick={() => setOpenComments(null)}
        >
          <div
            className="bg-bgSurface w-full max-h-[70vh] rounded-t-2xl p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-offwhite font-semibold">Комментарии</span>
              <button onClick={() => setOpenComments(null)} className="text-muted text-xl">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
              {comments.length === 0 && (
                <p className="text-muted text-sm text-center">Пока нет комментариев.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="text-gold font-semibold">
                    {c.users?.first_name ?? "Гость"}:{" "}
                  </span>
                  {me && c.user_id === me.id ? (
                    <OwnTextActions
                      api="/api/comments/manage"
                      id={c.id}
                      body={c.body}
                      onDone={(k) => {
                        if (k === "delete" && openComments) setCommentCounts((prev) => ({ ...prev, [openComments]: Math.max(0, (prev[openComments] ?? 1) - 1) }));
                        if (openComments) openCommentsFor(openComments);
                      }}
                    >
                      <span className="text-offwhite">{c.body}</span>{(c as any).edited_at && <span className="text-muted text-[10px] ml-1">изменено</span>}
                    </OwnTextActions>
                  ) : (
                    <>
                      <span className="text-offwhite">{c.body}</span>{(c as any).edited_at && <span className="text-muted text-[10px] ml-1">изменено</span>}
                      <OtherCommentActions
                        commentId={c.id}
                        canDelete={!!me && allPosts.find((x) => x.id === openComments)?.participants?.user_id === me.id}
                        loggedIn={!!me}
                        onDeleted={() => {
                          if (openComments) {
                            setCommentCounts((prev) => ({ ...prev, [openComments]: Math.max(0, (prev[openComments] ?? 1) - 1) }));
                            openCommentsFor(openComments);
                          }
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Написать комментарий..."
                className="flex-1 bg-bgPrimary text-offwhite border border-muted rounded-full px-4 py-2 text-sm"
              />
              <button
                onClick={sendComment}
                disabled={!commentText.trim()}
                className="bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-40"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

// ---------------------------------------------------------------------
// ПОКАЗ, ПОКА НЕТ РЕАЛЬНЫХ ВИДЕО — красивая рабочая витрина вместо
// скучной надписи «раздел появится позже». Как только участницы
// загрузят первые ролики, страница выше автоматически покажет уже их.
// ---------------------------------------------------------------------

const DEMO_CARDS = [
  { name: "Анна", likes: 214, comments: 38, caption: "Съёмка для журнала VETOKS ✨" },
  { name: "Виктория", likes: 189, comments: 22, caption: "Отбор — этап 1, всем привет!" },
  { name: "Дарья", likes: 302, comments: 61, caption: "Спасибо за поддержку, девочки 💛" },
];

function MediaShowcase() {
  const [liked, setLiked] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [voted, setVoted] = useState(false);
  const card = DEMO_CARDS[0];

  return (
    <main className="min-h-screen bg-black flex justify-center">
      <div className="h-screen w-full max-w-md relative">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, #2a1f3d 0%, #1a1620 55%, #241826 100%)",
          }}
        />

        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-white text-xs font-semibold">Рекомендации</span>
            <span className="text-white/55 text-xs">Подписки</span>
            <span className="text-white/55 text-xs">Вся страна</span>
          </div>
          <IconSearchWhite />
        </div>

        <div className="absolute right-2.5 bottom-28 flex flex-col items-center gap-4 z-10">
          <div className="relative mb-1">
            <div className="w-11 h-11 rounded-full bg-[#3c3489] border-2 border-white" />
            {!followed && (
              <button
                onClick={() => setFollowed(true)}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[17px] h-[17px] rounded-full bg-danger flex items-center justify-center"
              >
                <IconPlusBadge />
              </button>
            )}
          </div>

          <button onClick={() => setLiked((v) => !v)} className="flex flex-col items-center">
            <IconHeart filled={liked} />
            <span className="text-white text-xs mt-0.5">{card.likes + (liked ? 1 : 0)}</span>
          </button>

          <button className="flex flex-col items-center">
            <IconComment />
            <span className="text-white text-xs mt-0.5">{card.comments}</span>
          </button>

          <button className="flex flex-col items-center">
            <IconShare />
            <span className="text-white text-[10px] mt-0.5">Поделиться</span>
          </button>

          <button
            onClick={() => setVoted(true)}
            disabled={voted}
            className="flex flex-col items-center disabled:opacity-50"
          >
            <IconCrownVote />
            <span className="text-white text-[10px] mt-0.5">
              {voted ? "Голос отдан" : "Голосовать"}
            </span>
          </button>
        </div>

        <div className="absolute left-0 right-0 bottom-0 px-4 pb-24 pt-16 bg-gradient-to-t from-black/90 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#534AB7] border border-gold" />
            <span className="text-white font-semibold text-sm">{card.name}</span>
          </div>
          <p className="text-white text-sm">{card.caption}</p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
