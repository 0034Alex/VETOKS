"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { chatGiftEmoji } from "@/lib/chatGifts";

// Витрина подарков в профиле: стопка значков и общее число. По нажатию — все подарки.
export default function GiftShowcase({ userId, className = "" }: { userId?: string; className?: string }) {
  const [d, setD] = useState<{ total: number; items: { name: string; qty: number; icon?: string }[]; hidden?: boolean } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiPost("/api/profile/gift-showcase", userId ? { userId } : {}).then((r) => {
      if (r?.ok && r.show) setD({ total: r.total, items: r.items, hidden: r.hidden });
    });
  }, [userId]);

  if (!d) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-3 bg-bgSurface border border-gold/40 rounded-2xl px-4 py-3 text-left ${className}`}
      >
        <span className="flex">
          {d.items.slice(0, 4).map((g, i) => (
            <i
              key={g.name}
              className="not-italic w-8 h-8 rounded-full bg-bgPrimary border-2 border-gold flex items-center justify-center text-base"
              style={{ marginLeft: i === 0 ? 0 : -9 }}
            >
              {g.icon ?? chatGiftEmoji(g.name)}
            </i>
          ))}
        </span>
        <span className="flex-1 text-offwhite text-[15px]">Подарков получено: {d.total}</span>
        <span className="text-muted">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md max-h-[80dvh] overflow-y-auto bg-bgSurface rounded-t-2xl p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-offwhite font-semibold">Подарки</p>
              <button onClick={() => setOpen(false)} className="text-muted text-xl" aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {d.items.map((g) => (
                <div key={g.name} className="bg-bgPrimary border border-gold/40 rounded-xl py-3 flex flex-col items-center gap-1">
                  <span className="text-4xl leading-none">{g.icon ?? chatGiftEmoji(g.name)}</span>
                  <span className="text-offwhite text-xs">{g.name}</span>
                  <span className="text-gold text-sm font-semibold">×{g.qty}</span>
                </div>
              ))}
            </div>
            {d.hidden && <p className="text-muted text-xs mt-3">Витрина скрыта от других в настройках. Её видите только вы.</p>}
          </div>
        </div>
      )}
    </>
  );
}
