"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Stage = {
  stage_number: number;
  title: string;
  ends_at: string | null;
  promo_video_url: string | null;
};

export default function PromoPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/promo");
        return;
      }

      if (u.region_id) {
        const { data: season } = await supabase
          .from("seasons")
          .select("id")
          .eq("region_id", u.region_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (season) {
          const { data: stages } = await supabase
            .from("season_stages")
            .select("stage_number, title, ends_at, promo_video_url")
            .eq("season_id", season.id)
            .order("stage_number", { ascending: true });

          const now = new Date();
          const current = (stages ?? []).find(
            (s: Stage) => s.ends_at && new Date(s.ends_at) > now
          );
          setStage((current as Stage) ?? null);
        }
      }
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">
          Промо-ролик
        </h1>
        <p className="text-muted text-sm mb-6">
          {stage ? stage.title : "Текущий этап"}
        </p>

        {loading && <p className="text-muted text-center">Загрузка...</p>}

        {!loading && stage?.promo_video_url ? (
          <video
            src={stage.promo_video_url}
            controls
            className="w-full rounded-xl bg-black"
          />
        ) : (
          !loading && (
            <div className="bg-bgSurface border border-muted rounded-xl p-8 text-center">
              <p className="text-muted text-sm">
                Ролик для этого этапа ещё не загружен — загляните позже.
              </p>
            </div>
          )
        )}
      </div>
      <BottomNav />
    </main>
  );
}
