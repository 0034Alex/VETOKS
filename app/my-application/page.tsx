"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
};

export default function MyApplicationPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/my-application");
        return;
      }
      setUserId(u.id);

      const { data: p } = await supabase
        .from("participants")
        .select("id, display_name, bio, photo_url")
        .eq("user_id", u.id)
        .maybeSingle();

      if (p) {
        setParticipant(p as Participant);
        setDisplayName((p as Participant).display_name);
        setBio((p as Participant).bio ?? "");
        setPhotoUrl((p as Participant).photo_url);
      }

      setLoading(false);
    })();
  }, [router]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!participant || !userId) return;
    setSaving(true);
    setNotice("");

    let newPhotoUrl = photoUrl;

    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const filePath = `${userId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("participant-photos")
        .upload(filePath, photoFile);

      if (uploadError) {
        setNotice(`Ошибка загрузки фото: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("participant-photos")
        .getPublicUrl(filePath);
      newPhotoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from("participants")
      .update({
        display_name: displayName,
        bio,
        photo_url: newPhotoUrl,
      })
      .eq("id", participant.id);

    if (error) {
      setNotice(`Ошибка сохранения: ${error.message}`);
    } else {
      setPhotoUrl(newPhotoUrl);
      setPhotoFile(null);
      setNotice("Сохранено!");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!participant) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Моя анкета</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только участницам конкурса.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-offwhite mb-6">
          Моя анкета
        </h1>

        <div className="w-32 h-32 rounded-full bg-bgSurface border border-muted overflow-hidden flex items-center justify-center mb-2">
          {photoPreview || photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview ?? photoUrl ?? ""}
              alt="Фото"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-muted text-xs">Нет фото</span>
          )}
        </div>
        <label className="bg-bgPrimary border border-gold text-gold text-sm font-semibold px-4 py-2 rounded-full cursor-pointer mb-6">
          Изменить фото
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </label>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">Имя</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">О себе</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>

          {notice && (
            <p className="text-gold text-sm text-center">{notice}</p>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
