"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const LABELS: Record<string, string> = {
  spam: "спам",
  nudity: "неприемлемое",
  violence: "насилие",
  fake: "обман",
  other: "другое",
};

type Item = {
  post_id: string;
  count: number;
  reasons: Record<string, number>;
  details: string[];
  post: { video_url: string | null; photo_url: string | null; caption: string | null; participants: { display_name: string } | null } | null;
};

// CRM → «Жалобы»
export default function AdminReportsPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await apiPost("/api/admin/reports", { action: "list" });
    setItems(r?.items ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(action: "keep" | "delete", postId: string) {
    if (action === "delete" && !confirm("Удалить ролик навсегда?")) return;
    await apiPost("/api/admin/reports", { action, postId });
    await load();
  }

  if (loading) return <p className="text-muted text-sm">Загрузка...</p>;
  if (items.length === 0) return <p className="text-muted text-sm">Новых жалоб нет 🎉</p>;

  return (
    <div className="max-w-lg flex flex-col gap-4">
      {items.map((it) => (
        <div key={it.post_id} className="bg-bgSurface border border-muted rounded-xl p-3">
          <p className="text-offwhite text-sm font-semibold">
            {it.post?.participants?.display_name ?? "Ролик уже удалён"} · жалоб: {it.count}
          </p>
          <p className="text-muted text-xs mb-2">
            {Object.entries(it.reasons)
              .map(([k, n]) => `${LABELS[k] ?? k} ×${n}`)
              .join(", ")}
          </p>
          {it.post?.video_url && (
            <video src={it.post.video_url} controls playsInline className="w-full max-h-72 rounded-lg bg-black mb-2" />
          )}
          {it.post?.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.post.photo_url} alt="" className="w-full max-h-72 object-contain rounded-lg mb-2" />
          )}
          {it.post?.caption && <p className="text-offwhite text-xs mb-1">{it.post.caption}</p>}
          {it.details.slice(0, 3).map((d, i) => (
            <p key={i} className="text-muted text-xs">«{d}»</p>
          ))}
          <div className="flex gap-2 mt-3">
            <button onClick={() => act("keep", it.post_id)} className="flex-1 border border-muted text-offwhite rounded-full py-2 text-sm">
              Оставить
            </button>
            <button onClick={() => act("delete", it.post_id)} className="flex-1 bg-danger text-white rounded-full py-2 text-sm">
              Удалить ролик
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
