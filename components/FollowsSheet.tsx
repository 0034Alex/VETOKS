"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";

type Item = { href: string; name: string; sub: string; photo: string | null; uid?: string; canFollow?: boolean; iFollow?: boolean };

// Окно со списком подписчиков или подписок человека.
export default function FollowsSheet({
  userId,
  kind,
  onClose,
}: {
  userId?: string;
  kind: "followers" | "following";
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState("");

  async function toggle(it: Item) {
    if (!it.uid || busy) return;
    setBusy(it.uid);
    const on = !it.iFollow;
    const r = await apiPost("/api/profile/follow", { userId: it.uid, on });
    if (r?.ok) setItems((prev) => (prev ?? []).map((x) => (x.uid === it.uid ? { ...x, iFollow: on } : x)));
    setBusy("");
  }

  useEffect(() => {
    (async () => {
      const r = await apiPost("/api/profile/follows", { userId, kind });
      if (r?.ok) {
        setHidden(!!r.hidden);
        setItems(r.items ?? []);
      } else setItems([]);
    })();
  }, [userId, kind]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5 max-h-[75vh] overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-offwhite font-semibold">{kind === "followers" ? "Подписчики" : "Подписки"}</p>
          <button onClick={onClose} className="text-muted text-xl" aria-label="Закрыть">
            ✕
          </button>
        </div>
        {items === null && <p className="text-muted text-sm text-center py-6">…</p>}
        {hidden && <p className="text-muted text-sm text-center py-6">Этот человек скрыл список.</p>}
        {!hidden && items && items.length === 0 && <p className="text-muted text-sm text-center py-6">Пока никого нет.</p>}
        <div className="flex flex-col">
          {(items ?? []).map((it) => (
            <div key={it.href} className="flex items-center gap-3 py-3 border-t border-muted/30">
              <Link href={it.href} className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className="w-11 h-11 rounded-full bg-bgPrimary border border-muted/50 bg-cover bg-center flex-none"
                  style={it.photo ? { backgroundImage: `url(${it.photo})` } : undefined}
                />
                <span className="min-w-0">
                  <span className="block text-offwhite text-sm truncate">{it.name}</span>
                  {it.sub && <span className="block text-muted text-xs">{it.sub}</span>}
                </span>
              </Link>
              {it.canFollow && (
                <button
                  onClick={() => toggle(it)}
                  disabled={busy === it.uid}
                  className={`flex-none rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    it.iFollow ? "border border-muted text-muted" : "bg-gold text-bgPrimary"
                  }`}
                >
                  {it.iFollow ? "Вы подписаны" : kind === "followers" ? "Подписаться в ответ" : "Подписаться"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
