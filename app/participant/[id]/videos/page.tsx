"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import VoteModal from "@/components/VoteModal";
import {
  IconHeart,
  IconComment,
  IconShare,
  IconCrownVote,
  IconPlusBadge,
} from "@/components/Icons";

type Post = {
  id: string;
  video_url: string;
  caption: string | null;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  users: { first_name: string } | null;
};

export default function ParticipantVideosPage() {
  const params = useParams();
  const participantId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const startIndex = Number(searchParams.get("start") ?? 0);

  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: participant } = await supabase
        .from("participants")
        .select("display_name, photo_url")
        .eq("id", participantId)
        .maybeSingle();
      setDisplayName(participant?.display_name ?? "");
      setPhotoUrl(participant?.photo_url ?? null);

      const { data } = await supabase
        .from("content_posts")
        .select("id, video_url, caption")
        .eq("participant_id", participantId)
        .not("video_url", "is", null)
        .order("submitted_at", { ascending: false });
      setPosts((data as Post[]) ?? []);

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

        const { data: followRow } = await supabase
          .from("participant_follows")
          .select("participant_id")
          .eq("user_id", u.id)
          .eq("participant_id", participantId)
          .maybeSingle();
        setIsFollowing(!!followRow);
      }

      setLoading(false);
    })();
  }, [participantId]);

  useEffect(() => {
    if (loading || posts.length === 0) return;
    const target = containerRef.current?.children[startIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [loading, posts.length, startIndex]);

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

  async function toggleFollow() {
    if (!me) return;
    if (isFollowing) {
      await supabase
        .from("participant_follows")
        .delete()
        .eq("participant_id", participantId)
        .eq("user_id", me.id);
      setIsFollowing(false);
    } else {
      await supabase
        .from("participant_follows")
        .insert({ participant_id: participantId, user_id: me.id });
      setIsFollowing(true);
    }
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

  async function share(postId: string) {
    const url = `${window.location.origin}/participant/${participantId}`;
    if (navigator.share) {
      navigator.share({ title: "VETOKS", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert("Ссылка скопирована!");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted bg-black">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex justify-center">
      <div
        ref={containerRef}
        className="h-screen w-full max-w-md overflow-y-scroll snap-y snap-mandatory relative"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div
          className="fixed top-0 left-0 right-0 z-30 flex justify-center"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="w-full max-w-md px-4 py-3 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent">
            <button onClick={() => router.back()} className="text-white text-xl">
              ←
            </button>
            <span className="text-white text-sm font-semibold">
              Видео — {displayName}
            </span>
          </div>
        </div>

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
              <Link href={`/participant/${participantId}`} className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-black/40 overflow-hidden border border-gold">
                  {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-white font-semibold text-sm">{displayName}</span>
              </Link>
              {p.caption && <p className="text-white text-sm mb-2">{p.caption}</p>}
            </div>

            <div className="absolute right-2.5 bottom-28 flex flex-col items-center gap-4">
              <div className="relative mb-1">
                <Link href={`/participant/${participantId}`}>
                  <div className="w-11 h-11 rounded-full bg-black/40 overflow-hidden border-2 border-white">
                    {photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                </Link>
                {!isFollowing && (
                  <button
                    onClick={toggleFollow}
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

              <button onClick={() => share(p.id)} className="flex flex-col items-center">
                <IconShare />
                <span className="text-white text-[10px] mt-0.5">Поделиться</span>
              </button>

              <button
                onClick={() => setVoteModalOpen(true)}
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

      {voteModalOpen && (
        <VoteModal
          participantId={participantId}
          userId={me?.id ?? null}
          onClose={() => setVoteModalOpen(false)}
        />
      )}

      <BottomNav />
    </main>
  );
}
