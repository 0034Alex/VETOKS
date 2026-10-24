"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

type C = { id: string; slug: string; name: string; kind: string; subs_count: number; frozen: boolean; owner_id: string };
type R = { id: string; channel_id: string; post_id: string | null; comment_id: string | null; reason: string; details: string; created_at: string; text: string; channel: { name: string; slug: string; frozen: boolean } | null };

// CRM → «Каналы»: жалобы, поиск каналов, скрыть пост/комментарий, заморозить канал, забанить владельца
export default function AdminChannelsPanel() {
  const [chs, setChs] = useState<C[]>([]);
  const [reps, setReps] = useState<R[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await apiPost("/api/admin/channels", { action: "overview", q });
    if (r?.ok) { setChs(r.channels); setReps(r.reports); }
  }, [q]);
  useEffect(() => { load(); }, [load]);
  const run = async (body: object, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await apiPost("/api/admin/channels", body);
    setMsg(r?.ok ? "Готово." : "Ошибка.");
    load();
  };
  const btn = "rounded-lg border border-muted px-3 py-1.5 text-xs text-offwhite";
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-offwhite font-semibold mb-2">Жалобы ({reps.length})</h2>
        {reps.length === 0 && <p className="text-muted text-sm">Открытых жалоб нет.</p>}
        <div className="flex flex-col gap-2">
          {reps.map((r) => (
            <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-3 text-sm">
              <p className="text-offwhite">Канал «{r.channel?.name}» · {r.comment_id ? "комментарий" : r.post_id ? "пост" : "канал"} · <b>{r.reason}</b></p>
              {r.text && <p className="text-muted break-words mt-1">{r.text.slice(0, 300)}</p>}
              {r.details && <p className="text-muted text-xs mt-1">«{r.details}»</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {(r.post_id || r.comment_id) && <button className={btn} onClick={() => run({ action: "hide", postId: r.comment_id ? undefined : r.post_id, commentId: r.comment_id }).then(() => run({ action: "dismiss", id: r.id }))}>Скрыть</button>}
                <button className={btn} onClick={() => run({ action: "freeze", id: r.channel_id, frozen: true })}>Заморозить канал</button>
                <button className={`${btn} text-danger`} onClick={() => run({ action: "ban_owner", id: r.channel_id }, "Забанить владельца канала?")}>Бан владельца</button>
                <button className={btn} onClick={() => run({ action: "dismiss", id: r.id })}>Закрыть жалобу</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-offwhite font-semibold mb-2">Каналы</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или ссылке" className="w-full bg-bgSurface border border-muted rounded-xl px-3 py-2 text-sm text-offwhite outline-none mb-3" />
        <div className="flex flex-col gap-2">
          {chs.map((c) => (
            <div key={c.id} className="bg-bgSurface border border-muted rounded-xl p-3 text-sm flex flex-wrap items-center gap-2 justify-between">
              <div className="min-w-0">
                <a href={`/c/${c.slug}`} target="_blank" className="text-offwhite font-semibold">{c.name}</a>
                <p className="text-muted text-xs">/c/{c.slug} · {c.kind} · {c.subs_count} подп.{c.frozen ? " · ❄ заморожен" : ""}</p>
              </div>
              <div className="flex gap-2">
                <button className={btn} onClick={() => run({ action: "freeze", id: c.id, frozen: !c.frozen })}>{c.frozen ? "Разморозить" : "Заморозить"}</button>
                <button className={`${btn} text-danger`} onClick={() => run({ action: "delete", id: c.id }, "Удалить канал со всеми постами?")}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {msg && <p className="text-goldSoft text-sm">{msg}</p>}
    </div>
  );
}
