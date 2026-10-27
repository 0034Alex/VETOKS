"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";

export type TopRow = { rank: number; participant_id: string; votes: number; display_name: string; photo_url: string | null };

const DEMO: TopRow[] = [1, 2, 3, 4, 5].map((n) => ({ rank: n, participant_id: "", votes: 0, display_name: `Участница ${n}`, photo_url: null }));
const TINT = ["from-gold/60", "from-goldSoft/40", "from-sec/40", "from-sec2/40", "from-gold/30"];

// Топ-5 не пирамидой, а лентой карточек: листается в бок, у лидера светящаяся рамка.
export default function TopCards({ rows }: { rows: TopRow[] }) {
  const router = useRouter();
  const demo = rows.length === 0;
  const list = (demo ? DEMO : rows).slice(0, 5);
  const [done, setDone] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");

  async function vote(id: string) {
    setMsg("");
    const r = await apiPost("/api/shop/vote", { participantId: id, count: 1 });
    if (r?.ok) setDone((d) => ({ ...d, [id]: (d[id] ?? 0) + 1 }));
    else if (r?.error === "auth") router.push("/login");
    else if (r?.error === "not_enough") router.push("/shop?section=votes");
    else setMsg("Не получилось проголосовать.");
  }

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-6 py-1 no-scrollbar" style={{ scrollbarWidth: "none" }}>
        {list.map((r, i) => (
          <div key={r.rank} className={`snap-start shrink-0 w-[150px] rounded-2xl bg-bgSurface border ${i === 0 ? "border-gold vt-glow" : "border-muted/40"}`}>
            <Link href={demo ? "#" : `/participant/${r.participant_id}`} className="block relative aspect-[3/4] bg-bgPrimary rounded-t-2xl overflow-hidden">
              {r.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photo_url} alt={r.display_name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-b ${TINT[i]} to-bgPrimary flex items-center justify-center text-4xl text-offwhite/70`}>{r.display_name[0]}</div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bgPrimary to-transparent" />
              <span className="absolute top-2 left-2 w-7 h-7 rounded-full bg-gold text-bgPrimary text-sm font-bold flex items-center justify-center">{r.rank}</span>
              {i === 0 && <span className="absolute top-2 right-2 text-lg">👑</span>}
              <span className="absolute bottom-2 left-2 right-2 text-offwhite text-sm font-semibold truncate">{r.display_name}</span>
            </Link>
            <div className="flex items-center justify-between px-3 pt-2 text-xs text-muted">
              <span>🗳 {(r.votes ?? 0) + (done[r.participant_id] ?? 0)}</span>
              <span>{demo ? "❤ 0" : ""}</span>
            </div>
            <div className="flex gap-2 p-2">
              {demo ? (
                <button disabled className="w-9 rounded-lg border border-muted/50 text-offwhite text-sm opacity-60" aria-label="Нравится">❤</button>
              ) : (
                <Link href={`/participant/${r.participant_id}`} className="w-9 rounded-lg border border-muted/50 text-offwhite text-sm flex items-center justify-center" aria-label="Профиль">👤</Link>
              )}
              <button disabled={demo} onClick={() => vote(r.participant_id)} className="flex-1 rounded-lg py-1.5 text-xs font-semibold bg-gold text-bgPrimary disabled:opacity-60">
                Голос
              </button>
            </div>
          </div>
        ))}
      </div>
      {demo && <p className="text-xs text-muted text-center px-6">Пример: так будет выглядеть Топ-5, когда появятся голоса.</p>}
      {msg && <p className="text-xs text-muted text-center px-6">{msg}</p>}
    </div>
  );
}
