"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Followed = {
  id: string;
  display_name: string;
  photo_url: string | null;
  href?: string;
  userFollow?: boolean;
};

export default function MyFollowsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [follows, setFollows] = useState<Followed[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(uid: string) {
    setLoading(true);
    const { data: followsData } = await supabase
      .from("participant_follows")
      .select("participant_id")
      .eq("user_id", uid);

    const ids = (followsData ?? []).map((f: { participant_id: string }) => f.participant_id);

    let list: Followed[] = [];
    if (ids.length > 0) {
      const { data: participantsData } = await supabase
        .from("participants")
        .select("id, display_name, photo_url")
        .in("id", ids);
      list = (participantsData as Followed[]) ?? [];
    }

    // Обычные люди, на которых подписан.
    const { data: uf } = await supabase.from("user_follows").select("followed_id").eq("follower_id", uid);
    const uids = (uf ?? []).map((r: { followed_id: string }) => r.followed_id);
    if (uids.length > 0) {
      const { data: us } = await supabase.from("users").select("id, first_name, photo_url").in("id", uids);
      list = list.concat(
        (us ?? []).map((x: { id: string; first_name: string | null; photo_url: string | null }) => ({
          id: x.id,
          display_name: x.first_name || "Без имени",
          photo_url: x.photo_url,
          href: `/u/${x.id}`,
          userFollow: true,
        }))
      );
    }
    setFollows(list);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/my-follows");
        return;
      }
      setUserId(u.id);
      await load(u.id);
    })();
  }, [router]);

  async function unfollow(participantId: string) {
    if (!userId) return;
    const item = follows.find((f) => f.id === participantId);
    if (item?.userFollow) {
      await apiPost("/api/profile/follow", { userId: participantId, on: false });
    } else {
      await supabase.from("participant_follows").delete().eq("participant_id", participantId).eq("user_id", userId);
    }
    setFollows((prev) => prev.filter((f) => f.id !== participantId));
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-offwhite mb-2 px-6">
          Мои подписки
        </h1>
        <p className="text-muted text-sm mb-6 px-6">
          Люди, на которых вы подписаны.
        </p>

        {loading && <LoadingScreen inline />}
        {!loading && follows.length === 0 && (
          <p className="text-muted text-center px-6">
            Вы пока ни на кого не подписаны — загляните в «Участницы» или в
            журнал на главной.
          </p>
        )}

        <div className="px-6 flex flex-col gap-2">
          {follows.map((f) => (
            <div
              key={f.id}
              className="bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3"
            >
              <Link href={f.href ?? `/participant/${f.id}`} className="flex items-center gap-3 flex-1">
                {f.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.photo_url}
                    alt={f.display_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-black/40" />
                )}
                <span className="text-offwhite font-semibold text-sm">
                  {f.display_name}
                </span>
              </Link>
              <button
                onClick={() => unfollow(f.id)}
                className="text-danger text-xs px-3 py-1.5 rounded-full border border-danger flex-shrink-0"
              >
                Отписаться
              </button>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
