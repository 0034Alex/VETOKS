"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";

export type TopRow = { rank: number; participant_id: string; votes: number; display_name: string; photo_url: string | null };

const DEMO: TopRow[] = [1, 2, 3, 4, 5].map((n) => ({ rank: n, participant_id: "", votes: 0, display_name: `Артист ${n}`, photo_url: null }));

function Ava({ r, cls }: { r: TopRow; cls: string }) {
  return r.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={r.photo_url} alt={r.display_name} className={`${cls} object-cover`} />
  ) : (
    <div className={`${cls} bg-sec/60 text-offwhite flex items-center justify-center font-bold`}>{r.display_name[0]}</div>
  );
}

// Топ-5: лидер широкой карточкой, под ним ещё четверо. Голосовать можно за любого из пяти.
export default function TopCards({ rows }: { rows: TopRow[] }) {
  const router = useRouter();
  const demo = rows.length === 0;
  const list = (demo ? DEMO : rows).slice(0, 5);
  const [added, setAdded] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function vote(id: string) {
    if (demo || busy) return;
    setBusy(id);
    setMsg("");
    const r = await apiPost("/api/shop/vote", { participantId: id, count: 1 });
    setBusy("");
    if (r?.ok) setAdded((d) => ({ ...d, [id]: (d[id] ?? 0) + 1 }));
    else if (r?.error === "auth") router.push("/login");
    else if (r?.error === "not_enough") {
      setMsg("Бесплатные голоса закончились.");
      router.push("/shop?section=votes");
    } else setMsg("Не получилось проголосовать.");
  }

  const lead = list[0];
  const rest = list.slice(1);
  const votes = (r: TopRow) => (r.votes ?? 0) + (added[r.participant_id] ?? 0);

  return (
    <div className="px-6">
      <div className="vt-glow relative flex items-center gap-3 p-3 rounded-2xl border border-gold bg-bgSurface">
        <Link href={demo ? "#" : `/participant/${lead.participant_id}`} className="shrink-0">
          <Ava r={lead} cls="w-[76px] h-[76px] rounded-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-offwhite font-semibold truncate">👑 {lead.display_name}</p>
          <p className="text-muted text-xs mt-0.5">🗳 {votes(lead)}</p>
        </div>
        <button disabled={demo || busy === lead.participant_id} onClick={() => vote(lead.participant_id)} className="rounded-lg px-4 py-2 text-sm font-semibold bg-gold text-bgPrimary disabled:opacity-60">
          Голос
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-2">
        {rest.map((r) => (
          <div key={r.rank} className="bg-bgSurface border border-muted/40 rounded-xl p-2 text-center min-w-0">
            <Link href={demo ? "#" : `/participant/${r.participant_id}`} className="block">
              <Ava r={r} cls="w-11 h-11 rounded-full mx-auto mb-1" />
              <p className="text-offwhite text-xs font-semibold truncate">{r.display_name}</p>
            </Link>
            <p className="text-muted text-[11px] mb-1.5">🗳 {votes(r)}</p>
            <button disabled={demo || busy === r.participant_id} onClick={() => vote(r.participant_id)} className="w-full rounded-md py-1 text-[11px] font-semibold bg-gold text-bgPrimary disabled:opacity-60">
              Голос
            </button>
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-muted text-center mt-2">{msg}</p>}
    </div>
  );
}
