"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

const FILTERS: [string, string][] = [
  ["open", "Открытые"],
  ["new", "Новые"],
  ["in_progress", "В работе"],
  ["done", "Закрытые"],
];
const LABEL: Record<string, string> = { new: "Новое", in_progress: "В работе", done: "Закрыто" };

// CRM → «Поддержка»: статусы и ответ.
export default function AdminSupportPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  async function load() {
    const r = await apiPost("/api/admin/support", { action: "list", countryId: getCrmCountry() });
    setRows(r?.rows ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await apiPost("/api/admin/support", { action: "status", id, status });
    await load();
  }

  async function reply(id: string) {
    const r = await apiPost("/api/admin/support", { action: "reply", id, text: drafts[id] ?? "" });
    if (r?.ok) {
      setNote((n) => ({
        ...n,
        [id]: r.delivered ? "Ответ отправлен человеку в уведомления." : "Ответ сохранён. Человек не входил в аккаунт — свяжитесь по телефону или почте.",
      }));
      setDrafts((d) => ({ ...d, [id]: "" }));
      await load();
    }
  }

  const shown = rows.filter((r) => {
    const s = r.status === "done" ? "done" : r.status === "in_progress" ? "in_progress" : "new";
    if (filter === "open") return s !== "done";
    return s === filter;
  });

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              filter === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-muted text-sm">Здесь пусто.</p>}
      <div className="flex flex-col gap-3">
        {shown.map((r) => (
          <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-4">
            <div className="flex justify-between items-start mb-1">
              <p className="text-gold font-semibold">{r.name}</p>
              <span className="text-muted text-xs">
                {LABEL[r.status] ?? "Новое"} · {new Date(r.created_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <p className="text-muted text-xs mb-2">
              {r.phone || "—"} · {r.email || "—"} {r.user_id ? "· есть аккаунт" : "· без аккаунта"}
            </p>
            <p className="text-offwhite text-sm mb-3 whitespace-pre-wrap">{r.message}</p>
            {r.reply && (
              <div className="border-l-2 border-gold pl-3 mb-3">
                <p className="text-muted text-[10px]">Наш ответ · {r.replied_at ? new Date(r.replied_at).toLocaleString("ru-RU") : ""}</p>
                <p className="text-offwhite text-sm whitespace-pre-wrap">{r.reply}</p>
              </div>
            )}
            <textarea
              value={drafts[r.id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
              rows={2}
              placeholder="Ответить..."
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => reply(r.id)}
                disabled={!(drafts[r.id] ?? "").trim()}
                className="bg-gold text-bgPrimary font-semibold px-4 py-1.5 rounded-full text-xs disabled:opacity-40"
              >
                Ответить и закрыть
              </button>
              {r.status !== "in_progress" && r.status !== "done" && (
                <button onClick={() => setStatus(r.id, "in_progress")} className="border border-muted text-offwhite px-3 py-1.5 rounded-full text-xs">
                  Взять в работу
                </button>
              )}
              {r.status !== "done" ? (
                <button onClick={() => setStatus(r.id, "done")} className="border border-muted text-offwhite px-3 py-1.5 rounded-full text-xs">
                  Закрыть без ответа
                </button>
              ) : (
                <button onClick={() => setStatus(r.id, "new")} className="border border-muted text-offwhite px-3 py-1.5 rounded-full text-xs">
                  Открыть снова
                </button>
              )}
            </div>
            {note[r.id] && <p className="text-success text-xs mt-2">{note[r.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
