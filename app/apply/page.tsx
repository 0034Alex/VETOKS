"use client";

import ConsentLinks from "@/components/ConsentLinks";
import { apiPost } from "@/lib/authClient";
import { cleanImage } from "@/lib/imageClean";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, resetCurrentUserCache } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { getMyCountry } from "@/lib/myCountry";

export default function ApplyPage() {
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  // Подать анкету можно только с подтверждённым номером (null — ещё проверяем).
  const [phoneOk, setPhoneOk] = useState<boolean | null>(null);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        resetCurrentUserCache();
        const u = await getCurrentUser();
        if (!stop && u) setPhoneOk(!!u.phone_verified);
      } catch {}
    };
    check();
    const id = setInterval(() => {
      if (phoneOkRef.current !== true) check();
    }, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
  const phoneOkRef = useRef<boolean | null>(null);
  phoneOkRef.current = phoneOk;

  // Черновик анкеты: после чтения документов поля остаются заполненными (фото выберите заново).
  useEffect(() => {
    try {
      const j = JSON.parse(sessionStorage.getItem("vt_apply_draft") || "{}");
      if (j.displayName) setDisplayName(String(j.displayName));
      if (j.age) setAge(String(j.age));
      if (j.city) setCity(String(j.city));
      if (j.bio) setBio(String(j.bio));
      if (j.agreed) setAgreed(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("vt_apply_draft", JSON.stringify({ displayName, age, city, bio, agreed }));
    } catch {}
  }, [displayName, age, city, bio, agreed]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!agreed) {
      setErrorMessage(
        "Нужно принять соглашение об участии и лицензию на контент."
      );
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      setStatus("error");
      setErrorMessage("Сначала войдите в аккаунт.");
      return;
    }

    if (!currentUser.phone_verified) {
      setStatus("error");
      setPhoneOk(false);
      setErrorMessage("Сначала подтвердите номер в Telegram: без него анкету подать нельзя.");
      return;
    }

    let photoUrl: string | null = null;

    if (photoFile) {
      let up: File;
      try {
        up = await cleanImage(photoFile);
      } catch (e: any) {
        setStatus("error");
        setErrorMessage(e?.message || "Не удалось обработать фото.");
        return;
      }
      const fileExt = up.name.split(".").pop();
      const filePath = `${currentUser.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("participant-photos")
        .upload(filePath, up);

      if (uploadError) {
        setStatus("error");
        setErrorMessage(`Не удалось загрузить фото: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("participant-photos")
        .getPublicUrl(filePath);
      photoUrl = publicUrlData.publicUrl;
      const chk = await apiPost("/api/upload/verify", { url: photoUrl, want: "image" });
      if (!chk?.ok) {
        setStatus("error");
        setErrorMessage("Этот файл не похож на фото. Загрузите JPG, PNG или WebP.");
        return;
      }
    }

    // Один общий национальный сезон — идёт одновременно во всех регионах,
    // регион не влияет на выбор сезона, только на то, где участница
    // отображается в списках/рейтинге.
    if (currentUser.age_category === "teen") {
      const pc = await apiPost("/api/parent/start", { action: "status" });
      if (!(pc?.ok && pc.approved)) {
        setStatus("error");
        setErrorMessage("Для участия в TEEN нужно согласие родителей. Откройте «Согласие родителей» на главной и отправьте ссылку маме, папе или опекуну.");
        return;
      }
    }
    const mcA = await getMyCountry();
    let seQ = supabase
      .from("seasons")
      .select("id")
      .eq("status", "registration")
      .order("created_at", { ascending: true })
      .limit(1);
    if (mcA.countryId) seQ = seQ.eq("country_id", mcA.countryId);
    const { data: season } = await seQ.maybeSingle();

    if (!season) {
      setStatus("error");
      setErrorMessage(
        "Сейчас регистрация закрыта — сезон ещё не открыт."
      );
      return;
    }

    const { error } = await supabase.from("applications").insert({
      user_id: currentUser.id,
      season_id: season.id,
      status: "submitted",
      form_data: {
        display_name: displayName,
        age,
        city,
        bio,
        photo_url: photoUrl,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(/phone_not_verified/i.test(error.message) ? "Сначала подтвердите номер в Telegram: без него анкету подать нельзя." : error.message);
    } else {
      await apiPost("/api/consent/record", { place: "apply" });
      try {
        sessionStorage.removeItem("vt_apply_draft");
      } catch {}
      setStatus("success");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-28">
        <h1 className="text-3xl font-semibold text-gold mb-4">
          Анкета отправлена!
        </h1>
        <p className="text-muted">
          Модератор рассмотрит вашу заявку и сообщит о решении.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="flex flex-col items-center px-6">
        <h1 className="text-3xl font-semibold text-gold mb-8 text-center">
          Анкета участницы
        </h1>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1 items-center">
            <div className="w-32 h-32 rounded-full bg-bgSurface border border-muted overflow-hidden flex items-center justify-center mb-2">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Предпросмотр"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-muted text-xs text-center px-2">
                  Нет фото
                </span>
              )}
            </div>
            <label className="bg-bgPrimary border border-gold text-gold text-sm font-semibold px-4 py-2 rounded-full cursor-pointer">
              Выбрать фото из галереи или снять камерой
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-left text-offwhite text-sm">Имя</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-left text-offwhite text-sm">Возраст</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-left text-offwhite text-sm">Город</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-left text-offwhite text-sm">О себе</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Я принимаю{" "}
              <ConsentLinks place="apply" fallbackHref="/legal/participation" fallbackText="соглашение об участии и лицензию на контент" />
            </span>
          </label>

          {phoneOk === false && (
            <div className="rounded-xl p-4 border border-gold bg-gradient-to-r from-sec/30 to-sec2/30 text-center">
              <p className="text-offwhite font-semibold text-sm mb-1">Подтвердите номер</p>
              <p className="text-muted text-xs mb-3">Анкету можно подать только с подтверждённым номером. Это быстро: откроется Telegram, нажмите «Поделиться номером».</p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("vetoks:verify-phone"))}
                className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
              >
                Подтвердить номер в Telegram
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading" || !agreed || phoneOk === false}
            className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full hover:bg-goldSoft transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Отправляем..." : "Отправить анкету"}
          </button>

          {status === "error" && (
            <p className="text-danger text-sm">{errorMessage}</p>
          )}
        </form>
      </div>

      <BottomNav />
    </main>
  );
}
