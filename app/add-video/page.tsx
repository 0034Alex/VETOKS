"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

export default function AddVideoPage() {
  const router = useRouter();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  async function handlePublish() {
    if (!videoFile) return;
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

    const fileExt = videoFile.name.split(".").pop();
    const filePath = `${p.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("media-videos")
      .upload(filePath, videoFile);

    if (uploadError) {
      setError(`Ошибка загрузки: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("media-videos")
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("content_posts").insert({
      participant_id: p.id,
      platform: "vetoks",
      video_url: publicUrlData.publicUrl,
      caption,
      is_verified: true,
    });

    if (insertError) {
      setError(`Ошибка публикации: ${insertError.message}`);
      setUploading(false);
      return;
    }

    router.push("/media");
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-offwhite mb-6">
          Добавить видео
        </h1>

        <div className="w-full max-w-sm aspect-[9/16] bg-bgSurface border border-muted rounded-xl overflow-hidden flex items-center justify-center mb-4">
          {videoPreview ? (
            <video src={videoPreview} controls className="w-full h-full object-cover" />
          ) : (
            <span className="text-muted text-sm px-4 text-center">
              Нет видео
            </span>
          )}
        </div>

        <label className="w-full max-w-sm text-center bg-bgPrimary border border-gold text-gold font-semibold py-3 rounded-full cursor-pointer mb-4">
          {videoFile ? "Заменить видео" : "Выбрать видео из галереи или снять камерой"}
          <input
            type="file"
            accept="video/*"
            capture="user"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Подпись к ролику..."
          rows={3}
          className="w-full max-w-sm bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mb-4"
        />

        <button
          onClick={handlePublish}
          disabled={!videoFile || uploading}
          className="w-full max-w-sm bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
        >
          {uploading ? "Публикуем..." : "Опубликовать"}
        </button>

        {error && <p className="text-danger text-sm mt-3">{error}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
