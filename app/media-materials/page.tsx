"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { getMyCountry, orCountry } from "@/lib/myCountry";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { useShow } from "@/lib/useShow";
import { cleanContest } from "@/lib/contest";

type Material = { id: string; type: string; file_url: string; title: string | null; show_key?: string | null };

// Сохранить в галерею: на телефоне открываем меню «Поделиться» с пунктом «Сохранить»,
// где нет такого меню — обычное скачивание.
async function saveFile(m: Material, setMsg: (s: string) => void) {
  const ext = (m.file_url.split("?")[0].split(".").pop() || (m.type === "video" ? "mp4" : "png")).slice(0, 5);
  const name = `${(m.title || "vetoks").replace(/[^\p{L}\p{N}]+/gu, "-")}.${ext}`;
  try {
    const blob = await (await fetch(m.file_url)).blob();
    const file = new File([blob], name, { type: blob.type || (m.type === "video" ? "video/mp4" : "image/png") });
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file] });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMsg("Файл скачан.");
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    window.open(m.file_url, "_blank");
    setMsg("Если файл открылся в браузере, нажмите и удерживайте его, затем «Сохранить».");
  }
}

export default function MediaMaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const { show: curShow } = useShow();
  const contest = cleanContest(curShow?.contest);
  const [msg, setMsg] = useState("");

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
        const mc = await getMyCountry();
        const { data } = await orCountry(
          supabase
            .from("media_materials")
            .select("id, type, file_url, title, show_key")
            .order("created_at", { ascending: false }),
          mc.countryId
        );
        setMaterials((data as Material[]) ?? []);
      }
      setLoading(false);
    })();
  }, [router]);

  if (!loading && !isParticipant) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <h1 className="text-2xl font-semibold text-gold mb-4">Материалы для монтажа</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только участницам конкурса.
        </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  const mine = materials.filter((m) => (m.show_key ?? "miss") === contest);
  const photos = mine.filter((m) => m.type === "photo");
  const videos = mine.filter((m) => m.type === "video");

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">
          Материалы для монтажа
        </h1>
        <p className="text-muted text-sm mb-6">
          Скачивайте и используйте в своих роликах и постах — фирменные фото и
          короткие видео VETOKS.
        </p>

        {loading && <LoadingScreen inline />}

        {!loading && videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-gold font-semibold text-sm mb-3">🎬 Видео</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {videos.map((m) => (
                <div key={m.id} className="bg-bgSurface border border-muted rounded-xl overflow-hidden">
                  <video src={m.file_url} className="w-full aspect-[9/16] object-cover" muted />
                  <p className="text-offwhite text-xs px-2 pt-2 truncate">{m.title ?? "Видео"}</p>
                  <button onClick={() => saveFile(m, setMsg)} className="m-2 mt-1 w-[calc(100%-1rem)] bg-gold text-bgPrimary text-xs font-semibold rounded-lg py-1.5">
                    Скачать в галерею
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && photos.length > 0 && (
          <div>
            <h2 className="text-gold font-semibold text-sm mb-3">📸 Фото</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((m) => (
                <div key={m.id} className="bg-bgSurface border border-muted rounded-xl overflow-hidden">
                  {/* прозрачные PNG показываем на шахматном фоне */}
                  <div className="w-full aspect-square" style={{ background: "repeating-conic-gradient(#2a2a2e 0% 25%, #1c1c20 0% 50%) 50% / 16px 16px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.file_url} alt="" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-offwhite text-xs px-2 pt-2 truncate">{m.title ?? "Фото"}</p>
                  <button onClick={() => saveFile(m, setMsg)} className="m-2 mt-1 w-[calc(100%-1rem)] bg-gold text-bgPrimary text-xs font-semibold rounded-lg py-1.5">
                    Скачать в галерею
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && <p className="text-muted text-xs text-center mb-3">{msg}</p>}

        {!loading && mine.length === 0 && (
          <p className="text-muted text-center">Материалов пока нет.</p>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
