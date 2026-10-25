"use client";

import { useCardsEnabled } from "@/lib/useCardsEnabled";
import { cleanImage } from "@/lib/imageClean";
import LoadingScreen from "@/components/LoadingScreen";
import { apiPost } from "@/lib/authClient";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, resetCurrentUserCache } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Region = { id: string; name: string };

export default function EditProfilePage() {
  const cardsOn = useCardsEnabled();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [regionId, setRegionId] = useState("");
  const [origRegion, setOrigRegion] = useState("");
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const partRow = useRef<{ photo_url: string | null; bio: string | null } | null>(null);

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
        .select("id, photo_url, bio")
        .eq("user_id", u.id)
        .maybeSingle();
      setIsParticipant(!!p);
      partRow.current = p ? { photo_url: (p as any).photo_url ?? null, bio: (p as any).bio ?? null } : null;

      const { data: enabledCountries } = await supabase.from("countries").select("id").eq("enabled", true);
      const countryIds = (enabledCountries ?? []).map((c: { id: string }) => c.id);
      let regionsQuery = supabase.from("regions").select("id, name, country_id").order("name", { ascending: true });
      if (countryIds.length > 0) regionsQuery = regionsQuery.in("country_id", countryIds);
      const { data: regionsData } = await regionsQuery;
      const allRegions = ((regionsData as (Region & { country_id: string })[]) ?? []);
      setRegions(allRegions);

      const row = u;
      if (row) {
        setFirstName(row.first_name ?? "");
        setPhone(row.phone ?? "");
        setEmail(row.email ?? "");
        setBio(((row as any).bio as string) ?? "");
        setRegionId(row.region_id ?? "");
        setOrigRegion(row.region_id ?? "");
        // Выбрать можно только регион своей страны: страну меняет персонал.
        const myCountry = allRegions.find((r) => r.id === row.region_id)?.country_id;
        if (myCountry) setRegions(allRegions.filter((r) => r.country_id === myCountry));
        if ((row as any).region_changed_at) {
          const until = new Date(new Date((row as any).region_changed_at).getTime() + 42 * 86400000);
          if (until.getTime() > Date.now()) setLockedUntil(until);
        }
        // у участницы одно фото и одно «о себе» на всё: берём из анкеты, если она есть
        setPhotoUrl(partRow.current?.photo_url ?? row.photo_url ?? null);
        if (partRow.current?.bio) setBio(partRow.current.bio);
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
      let up: File;
      try {
        up = await cleanImage(photoFile);
      } catch (e: any) {
        setNotice(e?.message || "Не удалось обработать фото.");
        setSaving(false);
        return;
      }
      const fileExt = up.name.split(".").pop();
      const filePath = `user-${userId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("participant-photos")
        .upload(filePath, up);

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

    if (regionId && regionId !== origRegion) {
      const rr = await apiPost("/api/profile/region", { regionId });
      if (!rr.ok) {
        setNotice(
          rr.error === "locked"
            ? "Регион можно менять только раз в сезон (6 недель)."
            : "Не удалось сменить регион. Попробуйте ещё раз."
        );
        setSaving(false);
        return;
      }
      setOrigRegion(regionId);
      setLockedUntil(new Date(Date.now() + 42 * 86400000));
    }

    const sv = await apiPost("/api/profile/update", {
      ...(isParticipant ? {} : { first_name: firstName }),
      phone,
      photo_url: newPhotoUrl,
      bio: bio.trim().slice(0, 300),
      ...(isParticipant ? { participant: { bio: bio.trim().slice(0, 300), photo_url: newPhotoUrl } } : {}),
    });
    resetCurrentUserCache();

    if (!sv?.ok) {
      setNotice(
        sv?.error === "bad_words"
          ? "Есть недопустимые слова. Перепишите без грубостей."
          : sv?.error === "phone_taken"
          ? "Этот номер уже используется другим аккаунтом."
          : sv?.error === "phone"
          ? "Проверьте номер телефона."
          : sv?.error === "rate_limited"
          ? sv.message || "Слишком много запросов, повторите позже."
          : "Не удалось сохранить. Попробуйте ещё раз."
      );
    } else {
      setPhotoUrl(newPhotoUrl);
      setPhotoFile(null);
      setNotice("Сохранено!");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-offwhite mb-6">
          Мой профиль
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
              disabled={isParticipant}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 disabled:opacity-60"
            />
            {isParticipant && <p className="text-muted text-[11px]">Имя участницы меняется через поддержку.</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">О себе</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Пара слов о вас. Видно в профиле."
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 text-sm"
            />
            <p className="text-muted text-[11px] text-right">{bio.length}/300</p>
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
            <label className="text-offwhite text-sm">Почта (для входа)</label>
            <input
              type="email"
              value={email}
              disabled
              className="bg-bgPrimary text-muted border border-muted rounded-lg px-4 py-3 cursor-not-allowed"
            />
            <p className="text-muted text-[11px]">
              Почту для входа сейчас изменить нельзя — обратитесь в поддержку,
              если нужно её сменить.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-offwhite text-sm">Регион</label>
            <select
              data-tr
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              disabled={!!lockedUntil}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 disabled:opacity-60"
            >
              <option value="">— не выбран —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-muted text-xs">
              {lockedUntil
                ? `Регион можно сменить после ${lockedUntil.toLocaleDateString("ru-RU")} — менять можно раз в сезон (6 недель).`
                : "Регион можно менять раз в сезон (6 недель)."}
            </p>
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
            <div className="mt-6">
              <p className="text-gold text-xs font-semibold mb-2 tracking-wide">Для конкурса</p>
              <div className="bg-bgSurface border border-muted rounded-xl divide-y divide-muted">
                <a href="/poster" className="p-4 flex items-center justify-between text-offwhite text-sm">
                  <span>🎀 Моя афіша</span>
                  <span>→</span>
                </a>
                <a href="/my-magazine" className="p-4 flex items-center justify-between text-offwhite text-sm">
                  <span>📖 Моя страница в журнале</span>
                  <span>→</span>
                </a>
                {cardsOn && (
                  <a href="/my-cards" className="p-4 flex items-center justify-between text-offwhite text-sm">
                    <span>🃏 Мои карточки</span>
                    <span>→</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
