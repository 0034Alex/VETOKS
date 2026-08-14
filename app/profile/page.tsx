"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";

type Participant = { id: string; display_name: string };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/register");
        return;
      }
      setUser(u);

      const { data: p } = await supabase
        .from("participants")
        .select("id, display_name")
        .eq("user_id", u.id)
        .maybeSingle();
      setParticipant(p as Participant | null);

      if (p) {
        const { count } = await supabase
          .from("votes")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", (p as Participant).id);
        setVoteCount(count ?? 0);
      }

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 pb-24">
      <h1 className="text-3xl font-semibold text-gold mb-6 text-center">
        Профиль
      </h1>

      <div className="max-w-sm mx-auto bg-bgSurface border border-muted rounded-xl p-6 flex flex-col gap-3">
        <p className="text-offwhite">
          <span className="text-muted">Имя: </span>
          {user?.first_name}
        </p>
        <p className="text-offwhite">
          <span className="text-muted">Регион: </span>
          {user?.regions?.name ?? "—"}
        </p>
        <p className="text-offwhite">
          <span className="text-muted">Реферальный код: </span>
          {user?.referral_code}
        </p>

        {participant && (
          <>
            <hr className="border-muted my-2" />
            <p className="text-gold font-semibold">
              Вы участница конкурса
            </p>
            <p className="text-offwhite">
              <span className="text-muted">Голосов набрано: </span>
              {voteCount}
            </p>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
