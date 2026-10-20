"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/currentUser";
import { apiPost } from "@/lib/authClient";

type Cand = { id: string; name: string; photo: string | null; region: string };
type Res = { id: string; name: string; photo: string | null; votes: number; pct: number; mine: boolean };

function Ava({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover bg-bgPrimary" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-bgPrimary text-gold font-semibold flex items-center justify-center"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Опрос этапа на главной: ввод имени → подсказка → бесплатный голос → карусель
// «за кого голосовали» (первой — выбор самого человека, дальше по убыванию).
export default function StagePoll() {
  const [question, setQuestion] = useState("");
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Res[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Cand[]>([]);
  const [searched, setSearched] = useState(false);
  const [chosen, setChosen] = useState<Cand | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(r: any) {
    setQuestion(r?.question ?? "");
    setAnswered(!!r?.answered);
    setResults(r?.results ?? []);
    setTotal(r?.total ?? 0);
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (u) apply(await apiPost("/api/survey", {}));
      setLoading(false);
    })();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onType(v: string) {
    setQ(v);
    setChosen(null);
    setErr("");
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) {
      setItems([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await apiPost("/api/survey", { action: "search", q: v });
      setItems(r?.items ?? []);
      setSearched(true);
    }, 250);
  }

  async function submit() {
    if (!chosen || busy) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/survey", { action: "answer", participantId: chosen.id });
    setBusy(false);
    if (r?.ok) apply(r);
    else setErr("Не получилось отправить. Попробуйте ещё раз.");
  }

  if (loading || !question) return null;

  return (
    <div className="px-6 mb-8">
      <div className="bg-gradient-to-br from-[#7C3AED]/20 to-[#EC4899]/20 border border-gold/30 rounded-2xl p-5">
        <p className="text-gold text-xs tracking-widest mb-2">ОПРОС</p>
        <h3 className="text-offwhite font-semibold text-lg mb-4">{question}</h3>

        {answered ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-success text-sm">Ваш голос принят</p>
              <p className="text-muted text-xs">{total} голосов</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {results.map((r) => (
                <Link key={r.id} href={`/participant/${r.id}`} className="shrink-0 w-[76px] flex flex-col items-center gap-1">
                  <span
                    className="rounded-full p-[3px]"
                    style={{
                      background: r.mine
                        ? "conic-gradient(#EC4899,#C9A227,#7C3AED,#EC4899)"
                        : "linear-gradient(135deg,#E8D48A,#C9A227)",
                    }}
                  >
                    <span className="block rounded-full border-[3px] border-bgPrimary overflow-hidden">
                      <Ava name={r.name} photo={r.photo} size={60} />
                    </span>
                  </span>
                  {r.mine && (
                    <span className="bg-gold text-bgPrimary text-[10px] font-bold rounded-md px-1.5 py-0.5">ТВОЙ ВЫБОР</span>
                  )}
                  <span className="text-offwhite text-[13px] font-semibold text-center leading-tight break-words w-full">{r.name}</span>
                  <span className="text-muted text-xs">
                    {r.votes} · {r.pct}%
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-muted text-xs mt-2">Новый этап — новый вопрос и новый голос.</p>
          </>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => onType(e.target.value)}
              placeholder="Начните писать имя участницы..."
              autoComplete="off"
              className="w-full bg-bgPrimary text-offwhite border border-muted rounded-lg px-4 py-2.5 mb-2"
            />
            {!chosen && items.length > 0 && (
              <div className="bg-bgSurface border border-muted/50 rounded-xl p-1.5 mb-3 flex flex-col gap-1">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      setChosen(it);
                      setQ(it.name);
                      setItems([]);
                    }}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-left min-h-[48px]"
                  >
                    <Ava name={it.name} photo={it.photo} size={36} />
                    <span className="flex flex-col">
                      <span className="text-offwhite text-sm font-semibold">{it.name}</span>
                      {it.region && <span className="text-muted text-xs">{it.region}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!chosen && searched && items.length === 0 && q.trim() && (
              <p className="text-muted text-xs mb-3">Такой участницы не нашли. Проверьте имя.</p>
            )}
            {err && <p className="text-danger text-xs mb-2">{err}</p>}
            <button
              onClick={submit}
              disabled={!chosen || busy}
              className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm disabled:opacity-40"
            >
              {chosen ? `Отдать голос за ${chosen.name}` : "Выберите участницу из списка"}
            </button>
            <p className="text-muted text-xs mt-2">Бесплатно. Один голос на этап.</p>
          </>
        )}
      </div>
    </div>
  );
}
