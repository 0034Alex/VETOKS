"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

const LABELS: Record<string, string> = {
  spam: "спам",
  nudity: "неприемлемое",
  violence: "насилие",
  hate: "оскорбления / травля",
  scam: "мошенничество",
  fake: "фейк / подмена",
  minor: "опасно для детей",
  illegal: "запрещённое",
  selfharm: "самоповреждение",
  ip: "авторские права",
  other: "другое",
};

type Item = {
  post_id: string;
  count: number;
  reasons: Record<string, number>;
  details: string[];
  post: { video_url: string | null; photo_url: string | null; caption: string | null; participants: { display_name: string } | null } | null;
};

type DmItem = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  messages: { sender_id: string; body: string; created_at: string }[];
};

const DM_LABELS: Record<string, string> = { ...LABELS, insult: "оскорбления" };

// Жалобы на личные переписки
function DmReports() {
  const [items, setItems] = useState<DmItem[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await apiPost("/api/admin/dm-reports", { countryId: getCrmCountry() || undefined });
    setItems(r?.items ?? []);
    setNames(r?.names ?? {});
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(action: "close" | "ban", id: string) {
    if (action === "ban" && !confirm("Заблокировать этого пользователя?")) return;
    await apiPost("/api/admin/dm-reports", { action, id });
    await load();
  }

  if (loading || items.length === 0) return null;
  return (
    <div className="max-w-lg flex flex-col gap-4 mb-8">
      <p className="text-offwhite font-semibold">✉️ Жалобы на переписки</p>
      {items.map((it) => (
        <div key={it.id} className="bg-bgSurface border border-muted rounded-xl p-3">
          <p className="text-offwhite text-sm font-semibold">
            На {names[it.reported_id] ?? "пользователя"} · от {names[it.reporter_id] ?? "пользователя"}
          </p>
          <p className="text-muted text-xs mb-2">
            {DM_LABELS[it.reason] ?? it.reason}
            {it.details ? ` · «${it.details}»` : ""}
          </p>
          <div className="bg-bgPrimary rounded-lg p-2 mb-2 max-h-56 overflow-y-auto">
            {it.messages.map((m, i) => (
              <p key={i} className="text-xs mb-1">
                <span className={m.sender_id === it.reported_id ? "text-danger" : "text-muted"}>
                  {names[m.sender_id] ?? (m.sender_id === it.reported_id ? "Обвиняемый" : "Жалобщик")}:
                </span>{" "}
                <span className="text-offwhite">{m.body}</span>
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => act("close", it.id)} className="flex-1 border border-muted text-offwhite rounded-full py-2 text-sm">
              Закрыть
            </button>
            <button onClick={() => act("ban", it.id)} className="flex-1 bg-danger text-white rounded-full py-2 text-sm">
              Заблокировать
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

type CItem = { comment_id: string; count: number; reasons: Record<string, number>; details: string[]; body: string; author: string };

// Жалобы на комментарии
function CommentReports() {
  const [items, setItems] = useState<CItem[]>([]);
  const [needSql, setNeedSql] = useState(false);

  async function load() {
    const r = await apiPost("/api/admin/comment-reports", { action: "list" });
    setItems(r?.items ?? []);
    setNeedSql(!!r?.needSql);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(action: "keep" | "delete", commentId: string) {
    if (action === "delete" && !confirm("Удалить комментарий?")) return;
    await apiPost("/api/admin/comment-reports", { action, commentId });
    await load();
  }

  if (needSql) return <p className="text-danger text-xs mb-6">Для жалоб на комментарии нужно выполнить SQL (он есть в сообщении).</p>;
  if (items.length === 0) return null;
  return (
    <div className="max-w-lg flex flex-col gap-4 mb-8">
      <p className="text-offwhite font-semibold">💬 Жалобы на комментарии</p>
      {items.map((it) => (
        <div key={it.comment_id} className="bg-bgSurface border border-muted rounded-xl p-3">
          <p className="text-offwhite text-sm font-semibold">
            {it.author} · жалоб: {it.count}
          </p>
          <p className="text-muted text-xs mb-2">
            {(Object.entries(it.reasons) as [string, number][])
              .map(([k, n]) => `${LABELS[k] ?? k}${n > 1 ? ` ×${n}` : ""}`)
              .join(", ")}
            {it.details.length ? ` · «${it.details.slice(0, 3).join("», «")}»` : ""}
          </p>
          <p className="bg-bgPrimary rounded-lg p-2 mb-2 text-offwhite text-sm">{it.body}</p>
          <div className="flex gap-2">
            <button onClick={() => act("keep", it.comment_id)} className="flex-1 border border-muted text-offwhite rounded-full py-2 text-sm">
              Оставить
            </button>
            <button onClick={() => act("delete", it.comment_id)} className="flex-1 bg-danger text-white rounded-full py-2 text-sm">
              Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// CRM → «Жалобы»
export default function AdminReportsPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await apiPost("/api/admin/reports", { action: "list", countryId: getCrmCountry() });
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

  if (items.length === 0)
    return (
      <>
        <DmReports />
        <CommentReports />
        <p className="text-muted text-sm">Новых жалоб на ролики нет 🎉</p>
      </>
    );

  return (
    <>
    <DmReports />
    <CommentReports />
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
    </>
  );
}
