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

function fmt(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Число плавно «набегает» до значения за ~0,9 с.
function useCountUp(target: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / 900);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function timeLeft(endsAt: string | null): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!(ms > 0)) return "";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d} д ${h} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function Counter({ voters }: { voters: number }) {
  const n = useCountUp(voters);
  return (
    <p className="flex items-center gap-2 text-offwhite text-sm font-semibold mb-3">
      <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
      {voters > 0 ? `Уже ответили ${fmt(n)} человек` : "Станьте первым, кто ответит"}
    </p>
  );
}

function Tease() {
  const hues = [265, 300, 330, 350, 20, 40];
  return (
    <div className="relative mt-4">
      <div className="flex gap-3 overflow-hidden blur-[7px] opacity-70 pointer-events-none select-none">
        {hues.map((h, i) => (
          <div key={i} className="shrink-0 w-[76px] flex flex-col items-center gap-1">
            <span className="rounded-full p-[3px]" style={{ background: "linear-gradient(135deg,rgb(var(--c-goldSoft)),rgb(var(--c-gold)))" }}>
              <span
                className="flex items-center justify-center rounded-full border-[3px] border-bgPrimary text-white font-bold text-xl"
                style={{ width: 66, height: 66, background: `hsl(${h},55%,38%)` }}
              >
                ?
              </span>
            </span>
            <span className="text-offwhite text-[13px] font-semibold">•••••</span>
            <span className="text-goldSoft text-xs">•• · ••%</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <p className="bg-bgPrimary/85 border border-gold/30 rounded-xl px-3 py-2 text-offwhite text-sm font-semibold text-center">
          Кто лидирует? Откроется после вашего голоса
        </p>
      </div>
    </div>
  );
}

function Total({ total }: { total: number }) {
  const n = useCountUp(total);
  return <p className="text-muted text-xs">{fmt(n)} голосов</p>;
}

// Опрос этапа на главной: ввод имени → подсказка → бесплатный голос → карусель
// «за кого голосовали» (первой — выбор самого человека, дальше по убыванию).
export default function StagePoll() {
  const [question, setQuestion] = useState("");
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Res[]>([]);
  const [total, setTotal] = useState(0);
  const [voters, setVoters] = useState(0);
  const [endsAt, setEndsAt] = useState<string | null>(null);
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
    setVoters(r?.voters ?? 0);
    setEndsAt(r?.endsAt ?? null);
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

  const leader = results.reduce<Res | null>((a, r) => (!a || r.votes > a.votes ? r : a), null);
  const mine = results.find((r) => r.mine) ?? null;
  const left = timeLeft(endsAt);
  const maxVotes = leader?.votes || 1;

  return (
    <div className="px-6 mb-8">
      <style>{`@keyframes spPop{from{opacity:0;transform:translateY(10px) scale(.88)}to{opacity:1;transform:none}}`}</style>
      <div className="bg-gradient-to-br from-sec/20 to-sec2/20 border border-gold/30 rounded-2xl p-5">
        <p className="text-gold text-xs tracking-widest mb-2">ОПРОС</p>
        <h3 className="text-offwhite font-semibold text-lg mb-4">{question}</h3>

        {answered ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-success text-sm font-semibold">Ваш голос принят</p>
              <Total total={total} />
            </div>
            {mine && leader && (
              <p className="text-goldSoft text-[13px] leading-snug bg-bgPrimary/50 border border-gold/30 rounded-xl px-3 py-2.5 mb-3">
                {mine.id === leader.id ? (
                  <>
                    Вы выбрали <b className="text-gold">лидера</b>: {mine.name} · {mine.pct}% голосов
                  </>
                ) : (
                  <>
                    Лидирует <b className="text-gold">{leader.name}</b> ({leader.pct}%). Ваш выбор — {mine.pct}%. В следующем этапе — новый голос.
                  </>
                )}
              </p>
            )}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {results.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/participant/${r.id}`}
                  className="shrink-0 w-[76px] flex flex-col items-center gap-1"
                  style={{ animation: "spPop .45s both", animationDelay: `${i * 70}ms` }}
                >
                  <span
                    className="rounded-full p-[3px]"
                    style={{
                      background: r.mine
                        ? "conic-gradient(rgb(var(--c-sec2)),rgb(var(--c-gold)),rgb(var(--c-sec)),rgb(var(--c-sec2)))"
                        : "linear-gradient(135deg,rgb(var(--c-goldSoft)),rgb(var(--c-gold)))",
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
                  <span className="text-goldSoft text-xs">
                    {r.votes} · {r.pct}%
                  </span>
                  <span className="block w-14 h-1 rounded bg-white/10 overflow-hidden">
                    <span className="block h-full bg-gold rounded" style={{ width: `${Math.round((r.votes / maxVotes) * 100)}%` }} />
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-muted text-xs mt-2">Новый этап — новый вопрос и новый голос.</p>
          </>
        ) : (
          <>
            <Counter voters={voters} />
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
              <p className="text-muted text-xs mb-3 text-center">Такой участницы не нашли. Проверьте имя.</p>
            )}
            {err && <p className="text-danger text-xs mb-2 text-center">{err}</p>}
            <div className="flex justify-center">
              <button
                onClick={submit}
                disabled={!chosen || busy}
                className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm disabled:opacity-40"
              >
                {chosen ? `Отдать голос за ${chosen.name}` : "Выберите из списка"}
              </button>
            </div>
            {left && <p className="text-goldSoft text-xs text-center mt-3">До конца этапа {left} · результаты уже идут</p>}
            <Tease />
          </>
        )}
      </div>
    </div>
  );
}
