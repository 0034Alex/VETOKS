"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import LoadingScreen from "@/components/LoadingScreen";

type Participant = {
  id: string;
  display_name: string;
  photo_url: string | null;
  votes: number;
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [contentCount, setContentCount] = useState(0);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/register");
        return;
      }
      setUser(u);
      setChecked(true);

      const { data: participantsData, count: pCount } = await supabase
        .from("participants")
        .select("id, display_name, photo_url", { count: "exact" })
        .eq("is_eliminated", false);

      const { data: votesData } = await supabase.from("votes").select("participant_id");
      const counts: Record<string, number> = {};
      (votesData ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });

      const list = (participantsData ?? []).map(
        (p: { id: string; display_name: string; photo_url: string | null }) => ({
          ...p,
          votes: counts[p.id] ?? 0,
        })
      );
      list.sort((a, b) => b.votes - a.votes);
      setParticipants(list.slice(0, 5));
      setParticipantCount(pCount ?? 0);

      const { count: usersCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true });
      setActiveUsersCount(usersCount ?? 0);

      const { count: postsCount } = await supabase
        .from("content_posts")
        .select("id", { count: "exact", head: true });
      setContentCount(postsCount ?? 0);
    })();
  }, [router]);

  if (!checked) return <LoadingScreen />;

  return (
    <main className="min-h-screen pb-24">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={32} />
      </div>

      <div className="px-6 mb-6">
        <p className="text-muted text-sm mb-1">
          Привет, {user?.first_name}! Ваш регион:
        </p>
        <h1 className="text-2xl font-semibold text-offwhite">
          {user?.regions?.name ?? "—"}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 mb-8">
        <div className="bg-bgSurface border border-muted rounded-xl p-4">
          <p className="text-gold text-xl font-semibold">
            {participantCount}
          </p>
          <p className="text-muted text-xs">Участниц сезона</p>
        </div>
        <div className="bg-bgSurface border border-muted rounded-xl p-4">
          <p className="text-gold text-xl font-semibold">
            {activeUsersCount}
          </p>
          <p className="text-muted text-xs">Пользователей</p>
        </div>
        <div className="bg-bgSurface border border-muted rounded-xl p-4">
          <p className="text-gold text-xl font-semibold">0</p>
          <p className="text-muted text-xs">Подарков сегодня</p>
        </div>
        <div className="bg-bgSurface border border-muted rounded-xl p-4">
          <p className="text-gold text-xl font-semibold">{contentCount}</p>
          <p className="text-muted text-xs">Роликов в соцсетях</p>
        </div>
      </div>

      <div className="px-6 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-offwhite">
          🔥 Участницы дня
        </h2>
        <Link href="/participants" className="text-gold text-sm">
          Смотреть всех →
        </Link>
      </div>

      {participants.length === 0 ? (
        <p className="text-muted text-center px-6 mb-8">
          Пока нет одобренных участниц.
        </p>
      ) : (
        <div className="flex gap-3 px-6 overflow-x-auto mb-8 pb-2">
          {participants.map((p, i) => (
            <div
              key={p.id}
              className="min-w-[140px] bg-bgSurface border border-muted rounded-xl overflow-hidden flex-shrink-0"
            >
              <div className="aspect-[3/4] bg-black/40 flex items-center justify-center relative">
                {i === 0 && (
                  <span className="absolute top-2 left-2 text-gold text-lg">
                    👑
                  </span>
                )}
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo_url}
                    alt={p.display_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted text-xs">Нет фото</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-offwhite text-sm font-semibold">
                  {p.display_name}
                </p>
                <p className="text-gold text-xs">♥ {p.votes}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-6 flex flex-col gap-3">
        <Link
          href="/media"
          className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-offwhite font-semibold">Смотри контент участниц</p>
            <p className="text-muted text-xs">Лучшие видео и закулисье сезона</p>
          </div>
          <span className="text-gold">→</span>
        </Link>
        <Link
          href="/shop"
          className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-offwhite font-semibold">Подарки участницам</p>
            <p className="text-muted text-xs">Поддержи любимую участницу</p>
          </div>
          <span className="text-gold">→</span>
        </Link>
        <Link
          href="/apply"
          className="border border-gold text-gold font-semibold px-8 py-3 rounded-full text-center hover:bg-bgSurface transition-colors"
        >
          Подать анкету на участие
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
