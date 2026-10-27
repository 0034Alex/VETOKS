"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const REASON: Record<string, string> = { adult: "18+", abuse: "Оскорбления", spam: "Спам", other: "Другое" };

type Item = {
  story_id: string;
  count: number;
  reasons: Record<string, number>;
  story: { id: string; kind: string; url: string; hidden: boolean; author: string; expires_at: string };
};

export default function AdminStoryReportsPanel() {
  const [items, setItems] = useState<Item[] | null>(null);

  async function load() {
    const r = await apiPost("/api/admin/story-reports", { action: "list" });
    setItems(r?.items ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(action: "keep" | "delete", id: string) {
    await apiPost("/api/admin/story-reports", { action, id });
    load();
  }

  if (items === null) return <p className="text-muted">Загрузка...</p>;
  return (
    <div className="max-w-2xl flex flex-col gap-3">
      <p className="text-muted text-xs">
        Жалобы на истории. После трёх жалоб от разных людей история скрывается автоматически, пока вы не решите: «Оставить» вернёт её, «Удалить» уберёт вместе с файлом.
      </p>
      {items.length === 0 && <p className="text-muted text-sm">Жалоб нет.</p>}
      {items.map((it) => (
        <div key={it.story_id} className="bg-bgSurface border border-muted/50 rounded-xl p-3 flex gap-3">
          <div className="w-24 h-36 rounded-lg overflow-hidden bg-black flex-none">
            {it.story.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.story.url} alt="" className="w-full h-full object-cover" />
            ) : (
              <video src={it.story.url} className="w-full h-full object-cover" controls playsInline />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-offwhite text-sm font-semibold truncate">{it.story.author || "—"}</p>
            <p className="text-muted text-xs">
              Жалоб: {it.count} · {Object.entries(it.reasons).map(([k, v]) => `${REASON[k] ?? k} ${v}`).join(", ")}
            </p>
            {it.story.hidden && <p className="text-yellow-500 text-xs">Скрыта автоматически</p>}
            <div className="flex gap-2 mt-auto">
              <button onClick={() => act("keep", it.story_id)} className="border border-muted text-offwhite text-xs rounded-full px-4 py-1.5">Оставить</button>
              <button onClick={() => act("delete", it.story_id)} className="border border-danger text-danger text-xs rounded-full px-4 py-1.5">Удалить</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
