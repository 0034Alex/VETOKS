"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Suggestion = { id: string; text: string };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ContentIdeasPage() {
  const router = useRouter();
  const [isParticipant, setIsParticipant] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [vetoksIdeas, setVetoksIdeas] = useState<Suggestion[]>([]);
  const [socialIdeas, setSocialIdeas] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(d: string) {
    setLoading(true);
    const { data } = await supabase
      .from("content_suggestions")
      .select("id, target, text, sort_order")
      .eq("suggestion_date", d)
      .order("sort_order", { ascending: true });

    setVetoksIdeas(
      (data ?? []).filter((s: { target: string }) => s.target === "vetoks")
    );
    setSocialIdeas(
      (data ?? []).filter((s: { target: string }) => s.target === "social")
    );
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/content-ideas");
        return;
      }
      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();
      setIsParticipant(!!p);
      if (p) await load(date);
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function changeDate(newDate: string) {
    setDate(newDate);
    load(newDate);
  }

  if (!loading && !isParticipant) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Идеи для контента</h1>
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
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">
          Идеи для контента
        </h1>
        <p className="text-muted text-sm mb-4">
          Не нужно ничего придумывать — выберите готовую идею на сегодня.
        </p>

        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mb-6"
        />

        {loading ? (
          <p className="text-muted text-center">Загрузка...</p>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-gold font-semibold text-sm mb-2">
                👑 Для VETOKS
              </h2>
              {vetoksIdeas.length === 0 ? (
                <p className="text-muted text-xs">
                  На эту дату идей пока нет — загляните позже.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {vetoksIdeas.map((s) => (
                    <div
                      key={s.id}
                      className="bg-bgSurface border border-gold/40 rounded-xl p-3 text-offwhite text-sm"
                    >
                      {s.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-gold font-semibold text-sm mb-2">
                📱 Для своих соцсетей
              </h2>
              {socialIdeas.length === 0 ? (
                <p className="text-muted text-xs">
                  На эту дату идей пока нет — загляните позже.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {socialIdeas.map((s) => (
                    <div
                      key={s.id}
                      className="bg-bgSurface border border-muted rounded-xl p-3 text-offwhite text-sm"
                    >
                      {s.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
