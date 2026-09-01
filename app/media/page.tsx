"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Post = {
  id: string;
  video_url: string;
  caption: string | null;
  participant_id: string;
  participants: { display_name: string; photo_url: string | null } | null;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  users: { first_name: string } | null;
};

export default function MediaPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("content_posts")
        .select("id, video_url, caption, participant_id, participants(display_name, photo_url)")
        .not("video_url", "is", null)
        .order("submitted_at", { ascending: false });
      setPosts((data as unknown as Post[]) ?? []);

      const { data: likesData } = await supabase.from("media_likes").select("post_id, user_id");
      const counts: Record<string, number> = {};
      (likesData ?? []).forEach((l: { post_id: string }) => {
        counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
      });
      setLikeCounts(counts);

      const u = await getCurrentUser();
      if (u) {
        setUserId(u.id);
        const mine = new Set(
          (likesData ?? [])
            .filter((l: { user_id: string }) => l.user_id === u.id)
            .map((l: { post_id: string }) => l.post_id)
        );
        setLikedIds(mine);
      }

      const stored = localStorage.getItem("vetoks_voted_ids");
      if (stored) setVotedIds(JSON.parse(stored));

      setLoading(false);
    })();
  }, []);

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
    if (!userId) return;
    if (likedIds.has(postId)) {
      await supabase.from("media_likes").delete().eq("post_id", postId).eq("user_id", userId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }));
    } else {
      await supabase.from("media_likes").insert({ post_id: postId, user_id: userId });
      setLikedIds((prev) => new Set(prev).add(postId));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    }
  }

  async function handleVote(participantId: string) {
    if (!userId || votedIds.includes(participantId)) return;
    await supabase.from("votes").insert({
      voter_id: userId,
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
    if (!userId || !openComments || !commentText.trim()) return;
    await supabase.from("media_comments").insert({
      post_id: openComments,
      user_id: userId,
      body: commentText,
    });
    setCommentText("");
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

  if (posts.length === 0) {
    return (
      <main className="min-h-screen bg-black flex justify-center">
        <div className="h-screen w-full max-w-md relative flex items-center justify-center overflow-hidden">
          <div
            className="w-full h-full"
            style={{
              background:
                "linear-gradient(135deg, #2a1f3d 0%, #0B0B0D 55%, #3d1f30 100%)",
            }}
          />

          <div className="absolute top-0 left-0 right-0 z-10">
            <PageHeader />
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted text-sm px-10 text-center">
              Здесь появятся ролики участниц — а пока вот как будет выглядеть
              лента
            </p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 pb-24 bg-gradient-to-t from-black/90 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-black/40 border border-gold flex items-center justify-center text-gold text-xs">
                👑
              </div>
              <span className="text-white font-semibold text-sm">
                Имя участницы
              </span>
            </div>
            <p className="text-white text-sm mb-2">
              Подпись под роликом будет здесь ✨
            </p>
            <button
              disabled
              className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white text-xs font-semibold px-4 py-2 rounded-full opacity-40"
            >
              ❤️ Поддержать
            </button>
          </div>

          <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
            <button disabled className="flex flex-col items-center">
              <span className="text-2xl">🤍</span>
              <span className="text-white text-xs">0</span>
            </button>
            <button disabled className="flex flex-col items-center">
              <span className="text-2xl">💬</span>
            </button>
            <button disabled className="flex flex-col items-center">
              <span className="text-2xl">🔗</span>
            </button>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div
        className="h-screen overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
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
              <button
                onClick={() => handleVote(p.participant_id)}
                disabled={votedIds.includes(p.participant_id) || !userId}
                className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-40"
              >
                {votedIds.includes(p.participant_id) ? "Голос отдан" : "❤️ Поддержать"}
              </button>
            </div>

            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
              <button
                onClick={() => toggleLike(p.id)}
                className="flex flex-col items-center"
              >
                <span className="text-2xl">
                  {likedIds.has(p.id) ? "❤️" : "🤍"}
                </span>
                <span className="text-white text-xs">{likeCounts[p.id] ?? 0}</span>
              </button>
              <button
                onClick={() => openCommentsFor(p.id)}
                className="flex flex-col items-center"
              >
                <span className="text-2xl">💬</span>
              </button>
              <button onClick={() => share(p)} className="flex flex-col items-center">
                <span className="text-2xl">🔗</span>
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
