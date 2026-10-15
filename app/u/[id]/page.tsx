"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import ProfileHero, { ProfileActions, BigBtn, TopBtn, shareLink } from "@/components/ProfileHero";

type Data = {
  isSelf: boolean;
  verified: boolean;
  name: string;
  photoUrl: string | null;
  bio: string;
  city: string | null;
  handle: string | null;
  socials: string[];
  following: number | null;
  canWrite: boolean;
};

// Страница обычного человека (не участницы).
export default function PublicUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/login?redirect=/u/${id}`);
        return;
      }
      if (data.user.id === id) {
        router.replace("/profile");
        return;
      }
      const r = await apiPost("/api/profile/public", { userId: id });
      if (!r?.ok) {
        setMissing(true);
        return;
      }
      if (r.participantId) {
        router.replace(`/participant/${r.participantId}`);
        return;
      }
      setD(r as Data);
    })();
  }, [id, router]);

  if (missing)
    return <main className="min-h-screen flex items-center justify-center text-muted">Профиль не найден.</main>;
  if (!d) return <main className="min-h-screen flex items-center justify-center text-muted">Загрузка...</main>;

  async function share() {
    const r = await shareLink(window.location.href, d!.name);
    if (r === "copied") {
      setToast("Ссылка скопирована");
      setTimeout(() => setToast(""), 2000);
    }
  }

  return (
    <main className="min-h-screen pb-36">
      <div className="max-w-md mx-auto">
        <ProfileHero
          photoUrl={d.photoUrl}
          name={d.name}
          city={d.city}
          bio={d.bio}
          handle={d.handle}
          verified={d.verified}
          socials={d.socials}
          stats={d.following === null ? [] : [{ value: d.following, label: "Подписки" }]}
          onShare={share}
          topRight={
            <TopBtn onClick={() => router.back()} label="Назад">
              <span className="text-xl leading-none">←</span>
            </TopBtn>
          }
        />
        <ProfileActions>
          {d.canWrite ? (
            <BigBtn href={`/chats/${id}`}>✉️ Написать</BigBtn>
          ) : (
            <BigBtn variant="on" disabled>
              Личные сообщения закрыты
            </BigBtn>
          )}
        </ProfileActions>
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-44 z-50 bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
