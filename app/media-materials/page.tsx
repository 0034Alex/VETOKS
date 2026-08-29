"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Material = { id: string; type: string; file_url: string; title: string | null };

export default function MediaMaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/media-materials");
        return;
      }
      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();
      setIsParticipant(!!p);

      if (p) {
        const { data } = await supabase
          .from("media_materials")
          .select("id, type, file_url, title")
          .order("created_at", { ascending: false });
        setMaterials((data as Material[]) ?? []);
      }
      setLoading(false);
    })();
  }, [router]);

  if (!loading && !isParticipant) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Материалы для монтажа</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только участницам конкурса.
        </p>
        <BottomNav />
      </main>
    );
  }

  const photos = materials.filter((m) => m.type === "photo");
  const videos = materials.filter((m) => m.type === "video");

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">
          Материалы для монтажа
        </h1>
        <p className="text-muted text-sm mb-6">
          Скачивайте и используйте в своих роликах и постах — фирменные фото и
          короткие видео VETOKS.
        </p>

        {loading && <p className="text-muted text-center">Загрузка...</p>}

        {!loading && videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-gold font-semibold text-sm mb-3">🎬 Видео</h2>
            <div className="grid grid-cols-2 gap-3">
              {videos.map((m) => (
                <a
                  key={m.id}
                  href={m.file_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bgSurface border border-muted rounded-xl overflow-hidden"
                >
                  <video src={m.file_url} className="w-full aspect-[9/16] object-cover" muted />
                  <p className="text-offwhite text-xs p-2 truncate">
                    {m.title ?? "Скачать"}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {!loading && photos.length > 0 && (
          <div>
            <h2 className="text-gold font-semibold text-sm mb-3">📸 Фото</h2>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((m) => (
                <a
                  key={m.id}
                  href={m.file_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bgSurface border border-muted rounded-xl overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.file_url} alt="" className="w-full aspect-square object-cover" />
                  <p className="text-offwhite text-xs p-2 truncate">
                    {m.title ?? "Скачать"}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {!loading && materials.length === 0 && (
          <p className="text-muted text-center">Материалов пока нет.</p>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
