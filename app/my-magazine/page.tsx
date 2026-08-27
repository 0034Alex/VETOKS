"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

export default function MyMagazinePage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [dream, setDream] = useState("");
  const [motto, setMotto] = useState("");
  const [funFact, setFunFact] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/my-magazine");
        return;
      }

      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!p) {
        setLoading(false);
        return;
      }
      setParticipantId(p.id);

      const { data: answers } = await supabase
        .from("magazine_answers")
        .select("dream, motto, fun_fact")
        .eq("participant_id", p.id)
        .maybeSingle();

      if (answers) {
        setDream(answers.dream ?? "");
        setMotto(answers.motto ?? "");
        setFunFact(answers.fun_fact ?? "");
      }
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    if (!participantId) return;
    setSaving(true);
    await supabase.from("magazine_answers").upsert({
      participant_id: participantId,
      dream,
      motto,
      fun_fact: funFact,
      updated_at: new Date().toISOString(),
    });
    setNotice("Сохранено!");
    setSaving(false);
    setTimeout(() => setNotice(""), 2000);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!participantId) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Страница журнала</h1>
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
          Моя страница в журнале
        </h1>
        <p className="text-muted text-sm mb-6">
          Эти ответы появятся на вашей странице глянцевого журнала на главном
          экране приложения.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-offwhite text-sm">О чём вы мечтаете?</label>
            <textarea
              value={dream}
              onChange={(e) => setDream(e.target.value)}
              rows={3}
              className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            />
          </div>
          <div>
            <label className="text-offwhite text-sm">Ваш девиз по жизни</label>
            <textarea
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              rows={2}
              className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            />
          </div>
          <div>
            <label className="text-offwhite text-sm">
              Интересный факт о себе
            </label>
            <textarea
              value={funFact}
              onChange={(e) => setFunFact(e.target.value)}
              rows={3}
              className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          {notice && <p className="text-success text-sm text-center">{notice}</p>}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
