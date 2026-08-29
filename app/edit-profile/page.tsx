"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Region = { id: string; name: string };

export default function EditProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [regionId, setRegionId] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/edit-profile");
        return;
      }
      setUserId(u.id);

      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();
      setIsParticipant(!!p);

      const { data: regionsData } = await supabase
        .from("regions")
        .select("id, name")
        .order("name", { ascending: true });
      setRegions((regionsData as Region[]) ?? []);

      const { data: row } = await supabase
        .from("users")
        .select("first_name, phone, email, region_id, photo_url")
        .eq("id", u.id)
        .maybeSingle();

      if (row) {
        setFirstName(row.first_name ?? "");
        setPhone(row.phone ?? "");
        setEmail(row.email ?? "");
        setRegionId(row.region_id ?? "");
        setPhotoUrl(row.photo_url ?? null);
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

  async function save() {
    if (!userId) return;
    setSaving(true);
    setNotice("");

    let newPhotoUrl = photoUrl;

    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const filePath = `user-${userId}-${Date.now()}.${fileExt}`;
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
      .from("users")
      .update({
        first_name: firstName,
        phone,
        email,
        region_id: regionId || null,
        photo_url: newPhotoUrl,
      })
      .eq("id", userId);

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

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-offwhite mb-6">
          Редактировать профиль
        </h1>

        <div className="w-28 h-28 rounded-full bg-bgSurface border border-muted overflow-hidden flex items-center justify-center mb-2">
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
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">Телефон</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">Почта для связи</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            />
            <p className="text-muted text-[11px]">
              Это контактная почта в профиле. Почту, которой вы входите в
              аккаунт, эта форма не меняет — для этого обратитесь в поддержку.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">Регион</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            >
              <option value="">— не выбран —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          {notice && (
            <p className="text-gold text-sm text-center">{notice}</p>
          )}

          {isParticipant && (
            <div className="bg-bgSurface border border-muted rounded-xl divide-y divide-muted mt-6">
              <a
                href="/my-application"
                className="p-4 flex items-center justify-between text-muted text-sm"
              >
                <span>📝 Моя анкета</span>
                <span>→</span>
              </a>
              <a
                href="/my-magazine"
                className="p-4 flex items-center justify-between text-muted text-sm"
              >
                <span>📖 Моя страница в журнале</span>
                <span>→</span>
              </a>
              <a
                href="/my-cards"
                className="p-4 flex items-center justify-between text-muted text-sm"
              >
                <span>🃏 Мои карточки</span>
                <span>→</span>
              </a>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
