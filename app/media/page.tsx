"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
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
  participants: { display_name: string; photo_url: string | null; region_id: string | null } | null;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  users: { first_name: string } | null;
};

type FeedTab = "region" | "following" | "country";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MediaPage() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [feedTab, setFeedTab] = useState<FeedTab>("region");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("content_posts")
        .select(
          "id, video_url, caption, participant_id, participants(display_name, photo_url, region_id)"
        )
        .not("video_url", "is", null)
        .order("submitted_at", { ascending: false });
      setAllPosts((data as unknown as Post[]) ?? []);

      const { data: likesData } = await supabase.from("media_likes").select("post_id, user_id");
      const counts: Record<string, number> = {};
      (likesData ?? []).forEach((l: { post_id: string }) => {
        counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
      });
      setLikeCounts(counts);

      const { data: commentsData } = await supabase.from("media_comments").select("post_id");
      const cCounts: Record<string, number> = {};
      (commentsData ?? []).forEach((c: { post_id: string }) => {
        cCounts[c.post_id] = (cCounts[c.post_id] ?? 0) + 1;
      });
      setCommentCounts(cCounts);

      const u = await getCurrentUser();
      if (u) {
        setMe(u);
        const mine = new Set(
          (likesData ?? [])
            .filter((l: { user_id: string }) => l.user_id === u.id)
            .map((l: { post_id: string }) => l.post_id)
        );
        setLikedIds(mine);

        const { data: followsData } = await supabase
          .from("participant_follows")
          .select("participant_id")
          .eq("user_id", u.id);
        setFollowedIds(
          new Set((followsData ?? []).map((f: { participant_id: string }) => f.participant_id))
        );
      }

      const stored = localStorage.getItem("vetoks_voted_ids");
      if (stored) setVotedIds(JSON.parse(stored));

      setLoading(false);
    })();
  }, []);

  const posts = (() => {
    let list = allPosts;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return list.filter((p) => p.participants?.display_name?.toLowerCase().includes(q));
    }
    if (feedTab === "region" && me?.region_id) {
      list = shuffle(list.filter((p) => p.participants?.region_id === me.region_id));
    } else if (feedTab === "following") {
      list = list.filter((p) => followedIds.has(p.participant_id));
    } else {
      list = shuffle(list);
    }
    return list;
  })();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );
    Object.values(videoRefs.current).forEach((v) => v && observer.observe(v));
    return () => observer.disconnect();
  }, [posts]);

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

  async function handleVote(participantId: string) {
    if (!me || votedIds.includes(participantId)) return;
    await supabase.from("votes").insert({
      voter_id: me.id,
      participant_id: participantId,
      weight: 1,
      is_paid: false,
    });
    const updated = [...votedIds, participantId];
    setVotedIds(updated);
    localStorage.setItem("vetoks_voted_ids", JSON.stringify(updated));
  }

  async function openCommentsFor(postId: string) {
    setOpenComments(postId);
    const { data } = await supabase
      .from("media_comments")
      .select("id, body, created_at, users(first_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data as unknown as Comment[]) ?? []);
  }

  async function sendComment() {
    if (!me || !openComments || !commentText.trim()) return;
    await supabase.from("media_comments").insert({
      post_id: openComments,
      user_id: me.id,
      body: commentText,
    });
    setCommentText("");
    setCommentCounts((prev) => ({ ...prev, [openComments]: (prev[openComments] ?? 0) + 1 }));
    await openCommentsFor(openComments);
  }

  async function share(post: Post) {
    const url = `${window.location.origin}/participant/${post.participant_id}`;
    if (navigator.share) {
      navigator.share({ title: "VETOKS", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert("Ссылка скопирована!");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (allPosts.length === 0) {
    return <MediaShowcase />;
  }

  return (
    <main className="min-h-screen bg-black flex justify-center">
      <div
        className="h-screen w-full max-w-md overflow-y-scroll snap-y snap-mandatory relative"
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

        {posts.length === 0 && (
          <div className="h-screen w-full flex items-center justify-center px-8 text-center">
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
            className="h-screen w-full snap-start relative flex items-center justify-center"
          >
            <video
              ref={(el) => {
                videoRefs.current[p.id] = el;
              }}
              src={p.video_url}
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />

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

              <button onClick={() => share(p)} className="flex flex-col items-center">
                <IconShare />
                <span className="text-white text-[10px] mt-0.5">Поделиться</span>
              </button>

              <button
                onClick={() => handleVote(p.participant_id)}
                disabled={votedIds.includes(p.participant_id) || !me}
                className="flex flex-col items-center disabled:opacity-50"
              >
                <IconCrownVote />
                <span className="text-white text-[10px] mt-0.5">
                  {votedIds.includes(p.participant_id) ? "Голос отдан" : "Голосовать"}
                </span>
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
                  <span className="text-offwhite">{c.body}</span>
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
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [voted, setVoted] = useState(false);
  const card = DEMO_CARDS[active];

  function next(dir: 1 | -1) {
    setActive((i) => (i + dir + DEMO_CARDS.length) % DEMO_CARDS.length);
    setLiked(false);
    setFollowed(false);
    setVoted(false);
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center pb-24">
      <div className="w-full max-w-md">
        <PageHeader />
      </div>
      <p className="text-muted text-xs text-center px-6 mb-3">
        Здесь появятся ролики участниц. А пока — как это будет выглядеть.
      </p>

      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ aspectRatio: "9 / 16" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, #2a1f3d 0%, #1a1620 55%, #241826 100%)",
          }}
        />

        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-black/70 to-transparent">
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

        <div className="absolute left-0 right-0 bottom-0 px-4 pb-6 pt-16 bg-gradient-to-t from-black/90 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#534AB7] border border-gold" />
            <span className="text-white font-semibold text-sm">{card.name}</span>
          </div>
          <p className="text-white text-sm">{card.caption}</p>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => next(-1)}
          className="bg-bgSurface border border-muted text-offwhite px-4 py-2 rounded-full text-sm"
        >
          ← Другой пример
        </button>
        <button
          onClick={() => next(1)}
          className="bg-bgSurface border border-muted text-offwhite px-4 py-2 rounded-full text-sm"
        >
          Другой пример →
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
