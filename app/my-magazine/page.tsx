"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

const BLOCK_1 = [
  "В чём ваша главная ментальная суперсила?",
  "Какое ваше правило жизни, которое вы никогда не нарушаете?",
  "Опишите свой характер тремя яркими прилагательными.",
  "Что помогает вам сохранять уверенность в моменты сомнений?",
  "Каким своим достижением вы гордитесь больше всего?",
  "Какое качество в людях вы считаете самым дефицитным сегодня?",
  "Чему главному научил вас прошлый год?",
];

const BLOCK_2 = [
  "Что для вас означает понятие «истинная красота»?",
  "Если бы у вас был микрофон на весь мир, что бы вы сказали?",
  "Какая женщина в истории или современности вас восхищает?",
  "В чём, по-вашему, заключается главная сила современной женщины?",
  "Какая мудрость или совет изменили ваше отношение к себе?",
  "Если бы вы могли изменить одну вещь в мире, что бы это было?",
  "Что для вас означает победа в этом конкурсе?",
];

const BLOCK_3 = [
  "Где находится ваше личное «место силы»?",
  "Какой фильм или книга лучше всего отражают вашу душу?",
  "Опишите ваш идеальный день — какой он?",
  "Что способно вызвать у вас искреннюю улыбку за секунду?",
  "Какое хобби или занятие заставляет вас забыть обо всём?",
  "Если бы ваша жизнь была фильмом, как бы он назывался?",
  "Что вас по-настоящему вдохновляет просыпаться по утрам?",
];

export default function MyMagazinePage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState<string | null>(null);

  const [q1, setQ1] = useState("");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState("");
  const [a2, setA2] = useState("");
  const [q3, setQ3] = useState("");
  const [a3, setA3] = useState("");

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
        .select("q1_question, q1_answer, q2_question, q2_answer, q3_question, q3_answer")
        .eq("participant_id", p.id)
        .maybeSingle();

      if (answers) {
        setQ1(answers.q1_question ?? "");
        setA1(answers.q1_answer ?? "");
        setQ2(answers.q2_question ?? "");
        setA2(answers.q2_answer ?? "");
        setQ3(answers.q3_question ?? "");
        setA3(answers.q3_answer ?? "");
      }
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    if (!participantId) return;
    setSaving(true);
    await supabase.from("magazine_answers").upsert({
      participant_id: participantId,
      q1_question: q1 || null,
      q1_answer: q1 ? a1 : null,
      q2_question: q2 || null,
      q2_answer: q2 ? a2 : null,
      q3_question: q3 || null,
      q3_answer: q3 ? a3 : null,
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

  const blocks = [
    { label: "Вопрос 1", options: BLOCK_1, q: q1, setQ: setQ1, a: a1, setA: setA1 },
    { label: "Вопрос 2", options: BLOCK_2, q: q2, setQ: setQ2, a: a2, setA: setA2 },
    { label: "Вопрос 3", options: BLOCK_3, q: q3, setQ: setQ3, a: a3, setA: setA3 },
  ];

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">
          Моя страница в журнале
        </h1>
        <p className="text-muted text-sm mb-6">
          Выберите по одному вопросу из каждого блока и ответьте — это появится
          на вашей странице глянцевого журнала на главном экране.
        </p>

        <div className="flex flex-col gap-6">
          {blocks.map((b, i) => (
            <div key={i}>
              <label className="text-offwhite text-sm font-semibold">{b.label}</label>
              <select
                value={b.q}
                onChange={(e) => b.setQ(e.target.value)}
                className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1 mb-2"
              >
                <option value="">— выберите вопрос —</option>
                {b.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {b.q && (
                <textarea
                  value={b.a}
                  onChange={(e) => b.setA(e.target.value)}
                  rows={3}
                  placeholder="Ваш ответ..."
                  className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
                />
              )}
            </div>
          ))}

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
