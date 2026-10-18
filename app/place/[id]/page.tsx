"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import LoadingScreen from "@/components/LoadingScreen";

type It = { postId: string; kind: "video" | "photo"; url: string };

export default function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [items, setItems] = useState<It[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push(`/login?redirect=/place/${id}`);
        return;
      }
      const r = await apiPost("/api/places", { action: "get", placeId: id });
      if (!r?.ok) {
        setMissing(true);
        return;
      }
      setName(r.place.name);
      setItems(r.items as It[]);
    })();
  }, [id, router]);

  if (missing)
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-offwhite">
        <p>Место не найдено</p>
        <button onClick={() => router.back()} className="text-gold">Назад</button>
      </main>
    );
  if (!items) return <LoadingScreen />;

  return (
    <main className="min-h-screen pb-28">
      <div className="flex items-center gap-3 px-4 py-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <button onClick={() => router.back()} className="text-offwhite text-xl w-8" aria-label="Назад">←</button>
        <div className="min-w-0">
          <p className="text-offwhite font-semibold truncate">📍 {name}</p>
          <p className="text-muted text-xs">{items.length} публикаций</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-muted text-sm text-center mt-10 px-6">Здесь пока нет публикаций.</p>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {items.map((it) => (
            <Link key={it.postId} href={`/post/${it.postId}`} className="relative aspect-[4/5] bg-bgSurface overflow-hidden block">
              {it.kind === "video" ? (
                <video src={it.url} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt="" className="w-full h-full object-cover pointer-events-none" />
              )}
              {it.kind === "video" && <span className="absolute right-1.5 top-1.5 text-white text-xs">▶</span>}
            </Link>
          ))}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
