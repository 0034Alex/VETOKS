"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PostRepostTag from "@/components/PostRepostTag";

type P = {
  id: string;
  kind: "video" | "photo";
  url: string;
  caption: string;
  ownerUserId: string;
  authorName: string;
  authorPhoto: string | null;
  authorHref: string;
  mine: boolean;
};

// Просмотр одной публикации (фото или видео обычного человека).
export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [post, setPost] = useState<P | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/login?redirect=/post/${id}`);
        return;
      }
      const r = await apiPost("/api/profile/post", { postId: id });
      if (!r?.ok) {
        setMissing(true);
        return;
      }
      setPost(r.post as P);
      setMeId(r.meId as string);
    })();
  }, [id, router]);

  async function report() {
    const r = await apiPost("/api/reports/create", { postId: id, reason: "other" });
    if (r?.ok) setReported(true);
  }

  if (missing) return <main className="min-h-screen flex items-center justify-center text-muted">Публикация не найдена.</main>;
  if (!post) return <LoadingScreen />;

  return (
    <main className="min-h-screen pb-36 bg-black">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 px-4 py-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
          <button onClick={() => router.back()} className="text-offwhite text-xl" aria-label="Назад">
            ←
          </button>
          <Link href={post.authorHref} className="flex items-center gap-3 min-w-0">
            <span
              className="w-9 h-9 rounded-full bg-bgSurface border border-muted/50 bg-cover bg-center flex-none"
              style={post.authorPhoto ? { backgroundImage: `url(${post.authorPhoto})` } : undefined}
            />
            <span className="text-offwhite text-sm font-semibold truncate">{post.authorName}</span>
          </Link>
        </div>

        {post.kind === "video" ? (
          <video src={post.url} controls playsInline className="w-full max-h-[70vh] bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.url} alt="" className="w-full max-h-[75vh] object-contain bg-black" />
        )}

        <div className="px-5 pt-4 flex items-center gap-6">
          <PostRepostTag postId={post.id} ownerUserId={post.ownerUserId} meId={meId} />
          {!post.mine && (
            <button onClick={report} disabled={reported} className="ml-auto text-muted text-xs disabled:opacity-60">
              {reported ? "Жалоба отправлена" : "Пожаловаться"}
            </button>
          )}
        </div>
        {post.caption && <p className="px-5 pt-3 text-offwhite text-sm whitespace-pre-line">{post.caption}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
