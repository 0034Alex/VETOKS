"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Kind = "video" | "photo" | null;

export default function AddVideoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    // Автоматически определяем — видео идёт в ленту «Медиа», фото — в
    // фотолента профиля.
    if (f.type.startsWith("video/")) {
      setKind("video");
    } else if (f.type.startsWith("image/")) {
      setKind("photo");
    } else {
      setKind(null);
      setError("Этот файл не похож на фото или видео.");
    }
  }

  async function handlePublish() {
    if (!file || !kind) return;
    setUploading(true);
    setError("");

    const u = await getCurrentUser();
    if (!u) {
      router.push("/login?redirect=/add-video");
      return;
    }

    const { data: p } = await supabase
      .from("participants")
      .select("id")
      .eq("user_id", u.id)
      .maybeSingle();

    if (!p) {
      setError("Этот раздел доступен только участницам.");
      setUploading(false);
      return;
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `${p.id}-${Date.now()}.${fileExt}`;
    const bucket = kind === "video" ? "media-videos" : "participant-photos";

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      setError(`Ошибка загрузки: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("content_posts").insert({
      participant_id: p.id,
      platform: "vetoks",
      media_type: kind,
      video_url: kind === "video" ? publicUrlData.publicUrl : null,
      photo_url: kind === "photo" ? publicUrlData.publicUrl : null,
      caption,
      is_verified: true,
    });

    if (insertError) {
      setError(`Ошибка публикации: ${insertError.message}`);
      setUploading(false);
      return;
    }

    // Видео уходит в общую ленту «Медиа», фото — в фотоленту профиля.
    router.push(kind === "video" ? "/media" : `/participant/${p.id}`);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setKind(null);
    setError("");
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">
          Добавить фото или видео
        </h1>
        <p className="text-muted text-xs text-center mb-6">
          Видео попадёт в общую ленту «Медиа», фото — в фотоленту вашего
          профиля.
        </p>

        <div className="w-full max-w-sm aspect-[9/16] bg-bgSurface border border-muted rounded-xl overflow-hidden flex items-center justify-center mb-4">
          {preview ? (
            kind === "video" ? (
              <video src={preview} controls className="w-full h-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full h-full object-cover" />
            )
          ) : (
            <span className="text-muted text-sm px-4 text-center">
              Нет фото или видео
            </span>
          )}
        </div>

        {!file ? (
          <div className="w-full max-w-sm flex flex-col gap-3 mb-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full text-center bg-bgPrimary border border-gold text-gold font-semibold py-3 rounded-full"
            >
              📷 Снять камерой
            </button>
            <button
              onClick={() => libraryInputRef.current?.click()}
              className="w-full text-center bg-bgPrimary border border-muted text-offwhite font-semibold py-3 rounded-full"
            >
              🖼 Загрузить с телефона
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <button
            onClick={reset}
            className="w-full max-w-sm text-center bg-bgPrimary border border-muted text-muted font-semibold py-2 rounded-full mb-4 text-sm"
          >
            Выбрать другое фото/видео
          </button>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Подпись..."
          rows={3}
          className="w-full max-w-sm bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mb-4"
        />

        <button
          onClick={handlePublish}
          disabled={!file || !kind || uploading}
          className="w-full max-w-sm bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
        >
          {uploading
            ? "Публикуем..."
            : kind === "photo"
            ? "Опубликовать фото"
            : "Опубликовать видео"}
        </button>

        {error && <p className="text-danger text-sm mt-3">{error}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
