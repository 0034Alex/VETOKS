"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

// Карточка публикации внутри переписки.
export default function SharedPost({ postId }: { postId: string }) {
  const [p, setP] = useState<{ url: string; kind: string; authorName: string; caption: string } | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    apiPost("/api/profile/posts", { ids: [postId] }).then((r) => {
      const it = r?.ok ? r.items?.[0] : null;
      if (it) setP(it);
      else setGone(true);
    });
  }, [postId]);
  if (gone) return <span className="text-sm opacity-80">Публикация недоступна</span>;
  return (
    <Link href={`/post/${postId}`} className="block w-44">
      <span className="block w-44 h-44 rounded-xl overflow-hidden bg-black/40 relative">
        {p && p.kind === "photo" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.url} alt="" className="w-full h-full object-cover" />
        )}
        {p && p.kind === "video" && <video src={p.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />}
        {p && p.kind === "video" && <span className="absolute inset-0 flex items-center justify-center text-white text-3xl">▶</span>}
      </span>
      <span className="block text-xs mt-1.5 font-semibold truncate">{p?.authorName ?? "Публикация"}</span>
      {p?.caption && <span className="block text-xs opacity-80 line-clamp-1">{p.caption}</span>}
    </Link>
  );
}
