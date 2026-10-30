"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import GiftShowcase from "@/components/GiftShowcase";
import BottomNav from "@/components/BottomNav";
import ProfileHero, { ProfileActions, BigBtn, TopBtn, shareLink } from "@/components/ProfileHero";
import FollowsSheet from "@/components/FollowsSheet";
import ProfileTabs from "@/components/ProfileTabs";
import BusinessProfile from "@/components/BusinessProfile";
import ShopLinkCard from "@/components/ShopLinkCard";

type Data = {
  isSelf: boolean;
  verified: boolean;
  official?: boolean;
  name: string;
  photoUrl: string | null;
  bio: string;
  city: string | null;
  nick: string | null;
  socials: string[];
  following: number | null;
  followers: number;
  posts: number;
  isFollowing: boolean;
  canWrite: boolean;
  isBusiness?: boolean;
  shop?: { id: string; user_id: string; name: string; logo_url: string | null } | null;
};

// Страница обычного человека (не участницы).
export default function PublicUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [d, setD] = useState<Data | null>(null);
  const [chs, setChs] = useState<any[]>([]);
  const [missing, setMissing] = useState(false);
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState<"followers" | "following" | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followers, setFollowers] = useState(0);

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
      apiPost("/api/channels", { action: "profile_list", userId: id }).then((x: any) => x?.ok && setChs(x.channels));
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
      setIsFollowing(!!r.isFollowing);
      setFollowers(Number(r.followers) || 0);
    })();
  }, [id, router]);

  if (missing)
    return <main className="min-h-screen flex items-center justify-center text-muted">Профиль не найден.</main>;
  if (!d) return <LoadingScreen />;

  async function toggleFollow() {
    if (busy) return;
    setBusy(true);
    const on = !isFollowing;
    const r = await apiPost("/api/profile/follow", { userId: id, on });
    if (r?.ok) {
      setIsFollowing(r.on);
      setFollowers((n) => Math.max(0, n + (r.on ? 1 : -1)));
    }
    setBusy(false);
  }

  async function share() {
    const r = await shareLink(d!.nick ? window.location.origin + `/n/${d!.nick}` : window.location.href, d!.name);
    if (r === "copied") {
      setToast("Ссылка скопирована");
      setTimeout(() => setToast(""), 2000);
    }
  }

  if (d.isBusiness)
    return (
      <main className="min-h-screen pb-36">
        <div className="max-w-md mx-auto">
          <BusinessProfile
            userId={id}
            topLeft={
              <TopBtn onClick={() => router.back()} label="Назад">
                <span className="text-xl leading-none">←</span>
              </TopBtn>
            }
          />
        </div>
        <BottomNav />
      </main>
    );

  return (
    <main className="min-h-screen pb-36">
      <div className="max-w-md mx-auto">
        <ProfileHero
          photoUrl={d.photoUrl}
          name={d.name}
          city={d.official ? "Официальная страница VETOKS" : d.city}
          bio={d.bio}
          verified={d.verified}
          presenceUserId={id}
          socials={d.socials}
          channels={chs}
          stats={[
            { value: d.posts, label: "Публикации" },
            { value: followers, label: "Подписчики", onClick: () => setSheet("followers") },
            ...(d.following === null ? [] : [{ value: d.following, label: "Подписки", onClick: () => setSheet("following") }]),
          ]}
          onShare={share}
          topRight={
            <TopBtn onClick={() => router.back()} label="Назад">
              <span className="text-xl leading-none">←</span>
            </TopBtn>
          }
        />
        {!d.isBusiness && (
          <div className="px-5 pt-5">
            <GiftShowcase userId={id} />
          </div>
        )}
        {!d.isBusiness && <ShopLinkCard shop={d.shop ?? null} />}
        <ProfileActions>
          {d.canWrite ? (
            <BigBtn href={`/chats/${id}`}>✉️ Написать</BigBtn>
          ) : (
            <BigBtn variant="on" disabled>
              Сообщения закрыты
            </BigBtn>
          )}
          <BigBtn variant={isFollowing ? "on" : "gold"} onClick={toggleFollow} disabled={busy}>
            {isFollowing ? "Отписаться" : "＋ Подписаться"}
          </BigBtn>
        </ProfileActions>
        <ProfileTabs userId={id} />
      </div>

      {sheet && <FollowsSheet userId={id} kind={sheet} onClose={() => setSheet(null)} />}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-44 z-50 bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
