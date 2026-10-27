"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

type Item = { id: string; name: string; photo: string | null };
type Res = Item & { votes: number; pct: number; mine: boolean };

const SAMPLE = "Кто, по-вашему, лучше всех выступил на этой неделе?";

function Ava({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover bg-bgPrimary" />
  ) : (
    <span style={{ width: size, height: size }} className="rounded-full bg-bgPrimary text-gold font-semibold flex items-center justify-center">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Опрос на главной шоу. Вопрос вводится в CRM → «Шоу». Пока вопроса нет — показываем макет.
export default function ShowPoll({ showId }: { showId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState("");
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Res[]>([]);
  const [voters, setVoters] = useState(0);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState("");

  function apply(r: any) {
    setQuestion(r?.question ?? "");
    setAnswered(!!r?.answered);
    setResults((r?.results as Res[]) ?? []);
    setVoters(Number(r?.voters ?? r?.total ?? 0));
  }

  useEffect(() => {
    (async () => {
      const r = await apiPost("/api/show/poll", { showId });
      if (r?.ok) apply(r);
      setLoaded(true);
    })();
  }, [showId]);

  useEffect(() => {
    if (!question || answered) return;
    const t = setTimeout(async () => {
      if (q.trim().length < 2) return setItems([]);
      const r = await apiPost("/api/show/poll", { showId, action: "search", q });
      setItems((r?.items as Item[]) ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, question, answered, showId]);

  async function pick(id: string) {
    setErr("");
    const r = await apiPost("/api/show/poll", { showId, action: "answer", participantId: id });
    if (r?.ok) apply(r);
    else setErr("Не получилось, попробуйте ещё раз.");
  }

  if (!loaded) return null;
  const demo = !question;

  return (
    <section className="px-6 mt-8">
      <div className="bg-bgSurface border border-gold/30 rounded-2xl p-4">
        <p className="text-gold text-[11px] font-semibold tracking-widest uppercase mb-1">Опрос</p>
        <p className="text-offwhite font-semibold leading-snug mb-3">{demo ? SAMPLE : question}</p>

        {demo && (
          <>
            <input disabled placeholder="Начните вводить имя участницы" className="w-full bg-bgPrimary border border-muted/40 rounded-lg px-3 py-2.5 text-sm opacity-60" />
            <p className="text-xs text-muted mt-3">Пример. Вопрос задаётся в CRM → «Шоу», голос бесплатный, результаты видны после ответа.</p>
          </>
        )}

        {!demo && !answered && (
          <>
            <p className="text-offwhite text-sm mb-2">{voters > 0 ? `Уже ответили ${voters} человек` : "Станьте первым, кто ответит"}</p>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Начните вводить имя участницы"
              className="w-full bg-bgPrimary border border-muted/40 rounded-lg px-3 py-2.5 text-sm text-offwhite"
            />
            <div className="flex flex-col gap-2 mt-2">
              {items.map((it) => (
                <button key={it.id} onClick={() => pick(it.id)} className="flex items-center gap-3 bg-bgPrimary rounded-lg px-3 py-2 text-left">
                  <Ava name={it.name} photo={it.photo} size={32} />
                  <span className="text-offwhite text-sm flex-1 truncate">{it.name}</span>
                  <span className="text-gold text-xs font-semibold">Выбрать</span>
                </button>
              ))}
            </div>
            {err && <p className="text-xs text-muted mt-2">{err}</p>}
          </>
        )}

        {!demo && answered && (
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <div key={r.id} className="relative overflow-hidden rounded-lg bg-bgPrimary">
                <div className="absolute inset-y-0 left-0 bg-gold/25" style={{ width: `${r.pct}%` }} />
                <div className="relative flex items-center gap-3 px-3 py-2">
                  <Ava name={r.name} photo={r.photo} size={30} />
                  <span className="text-offwhite text-sm flex-1 truncate">
                    {r.name}
                    {r.mine ? " ✓" : ""}
                  </span>
                  <span className="text-gold text-sm font-semibold">{r.pct}%</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted mt-1">{voters} голосов</p>
          </div>
        )}
      </div>
    </section>
  );
}
