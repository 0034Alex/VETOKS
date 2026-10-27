"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";

type Side = { participantId: string; postId: string; videoUrl: string | null; name: string; photo: string | null };
type Round = { id: string; endsAt: string; a: Side; b: Side; votes: { a: number; b: number }; my: Record<string, string> };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// «Битва»: два ролика региона друг против друга, новая пара каждые 30 минут.
export default function BattleCard({ contest }: { contest: string }) {
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [needBuy, setNeedBuy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiPost("/api/battle", { action: "get", contest });
    setRound((r?.round as Round) ?? null);
    setLoaded(true);
    setNeedBuy(false);
    setMsg("");
  }, [contest]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!round) return;
      const ms = new Date(round.endsAt).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) load();
    }, 1000);
    return () => clearInterval(t);
  }, [round, load]);

  async function act(kind: "like" | "vote", side: "a" | "b") {
    if (!round || busy) return;
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/battle", { action: kind, contest, roundId: round.id, side });
    setBusy(false);
    if (r?.ok && r.round) {
      setRound(r.round as Round);
      return;
    }
    if (r?.error === "auth") return router.push("/login");
    if (r?.error === "not_enough") {
      setNeedBuy(true);
      setMsg("Бесплатные голоса закончились.");
      return;
    }
    if (r?.error === "already") setMsg(kind === "like" ? "Вы уже поставили лайк в этой битве." : "Вы уже голосовали в этой битве.");
    else if (r?.error === "round_over") load();
    else setMsg("Не получилось, попробуйте ещё раз.");
  }

  if (!loaded) return null;
  if (!round) return <BattleEmpty />;
  const total = round.votes.a + round.votes.b;
  const pa = total ? Math.round((round.votes.a / total) * 100) : 50;

  const Half = ({ s, side }: { s: Side; side: "a" | "b" }) => (
    <div className="flex-1 min-w-0">
      <div className="relative aspect-[9/14] rounded-xl overflow-hidden bg-bgSurface border border-gold/30">
        {s.videoUrl ? (
          <video src={s.videoUrl} poster={s.photo ?? undefined} playsInline controls preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        {round.my.vote === side && <span className="absolute top-2 left-2 text-[10px] bg-gold text-bgPrimary rounded-full px-2 py-0.5 font-semibold">Ваш голос</span>}
      </div>
      <Link href={`/participant/${s.participantId}`} className="block text-offwhite text-sm font-semibold truncate mt-2">
        {s.name}
      </Link>
      <div className="flex gap-2 mt-1">
        <button
          disabled={busy || !!round.my.like}
          onClick={() => act("like", side)}
          className={`flex-1 rounded-lg py-2 text-sm border ${round.my.like === side ? "bg-gold/20 border-gold text-gold" : "border-muted/50 text-offwhite"} disabled:opacity-60`}
        >
          ❤ Лайк
        </button>
        <button
          disabled={busy || !!round.my.vote}
          onClick={() => act("vote", side)}
          className="flex-1 rounded-lg py-2 text-sm font-semibold bg-gold text-bgPrimary disabled:opacity-60"
        >
          🗳 Голос
        </button>
      </div>
    </div>
  );

  return (
    <section className="px-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-offwhite">⚔ Битва региона</h2>
        <span className="text-xs text-gold border border-gold/40 rounded-full px-2.5 py-1">Новая пара через {fmt(left || new Date(round.endsAt).getTime() - Date.now())}</span>
      </div>
      <div className="flex gap-3">
        <Half s={round.a} side="a" />
        <div className="flex flex-col items-center justify-center text-gold font-bold">VS</div>
        <Half s={round.b} side="b" />
      </div>
      <div className="mt-3 h-2 rounded-full overflow-hidden bg-bgSurface flex">
        <div className="bg-gold transition-all" style={{ width: `${pa}%` }} />
        <div className="bg-sec2 transition-all" style={{ width: `${100 - pa}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>{round.votes.a}</span>
        <span>{round.votes.b}</span>
      </div>
      {msg && <p className="text-xs text-muted text-center mt-2">{msg}</p>}
      {needBuy && (
        <Link href="/shop?section=votes" className="block text-center mt-2 rounded-lg py-2.5 text-sm font-semibold bg-gold text-bgPrimary">
          Купить голоса
        </Link>
      )}
    </section>
  );
}

// Заглушка: в регионе пока нет двух участниц с видео — показываем, как будет выглядеть блок.
function BattleEmpty() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const SLOT = 30 * 60 * 1000;
  const left = (Math.floor(now / SLOT) + 1) * SLOT - now;
  const Stub = ({ n }: { n: string }) => (
    <div className="flex-1 min-w-0">
      <div className="relative aspect-[9/14] rounded-xl overflow-hidden bg-bgSurface border border-gold/20 flex flex-col items-center justify-center text-muted gap-2">
        <span className="text-4xl">▶</span>
        <span className="text-xs">Видео {n}</span>
      </div>
      <div className="text-muted text-sm font-semibold truncate mt-2">Артист {n}</div>
      <div className="flex gap-2 mt-1">
        <button disabled className="flex-1 rounded-lg py-2 text-sm border border-muted/40 text-muted opacity-60">❤ Лайк</button>
        <button disabled className="flex-1 rounded-lg py-2 text-sm font-semibold bg-gold/40 text-bgPrimary opacity-60">🗳 Голос</button>
      </div>
    </div>
  );
  return (
    <section className="px-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-offwhite">⚔ Битва региона</h2>
        <span className="text-xs text-gold border border-gold/40 rounded-full px-2.5 py-1">Новая пара через {fmt(left)}</span>
      </div>
      <div className="flex gap-3">
        <Stub n="1" />
        <div className="flex flex-col items-center justify-center text-gold font-bold">VS</div>
        <Stub n="2" />
      </div>
      <div className="mt-3 h-2 rounded-full overflow-hidden bg-bgSurface flex">
        <div className="bg-gold/40" style={{ width: "50%" }} />
        <div className="bg-sec2/40" style={{ width: "50%" }} />
      </div>
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>0</span>
        <span>0</span>
      </div>
    </section>
  );
}

