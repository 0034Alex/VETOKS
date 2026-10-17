"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/authClient";

type R = { id: string; name: string; nick: string; photoUrl: string | null; recent: boolean };

const ERR: Record<string, string> = {
  dm_closed: "закрыл сообщения",
  cant_send: "написать нельзя",
  you_blocked: "вы его заблокировали",
  too_many_requests: "слишком много запросов",
  request_limit: "ждёт ответа",
};

// «Поделиться»: сначала люди внутри приложения (недавние и мои подписки, ниже поиск), затем другие площадки.
export default function ShareSheet({ open, onClose, postId }: { open: boolean; onClose: () => void; postId: string; caption?: string }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<R[]>([]);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSent({});
    setCopied(false);
    apiPost("/api/share/recipients", {}).then((r) => setList(r?.ok ? r.items : []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      apiPost("/api/share/recipients", { q: q.trim() }).then((r) => setList(r?.ok ? r.items : []));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, open]);

  if (!open) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/post/${postId}` : "";

  async function sendTo(r: R) {
    if (sent[r.id] || busy) return;
    setBusy(r.id);
    const res = await apiPost("/api/dm/send", { toUserId: r.id, postId });
    setBusy(null);
    setSent((s) => ({ ...s, [r.id]: res?.ok ? "ok" : ERR[res?.error] ?? "не удалось" }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/65 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-bgSurface rounded-t-3xl max-h-[85dvh] flex flex-col"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-white/25" />
        </div>
        <p className="text-offwhite font-semibold text-center pt-3 pb-3">Поделиться</p>

        <div className="px-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Найти человека по имени или нику"
            className="w-full bg-bgPrimary text-offwhite border border-muted rounded-full px-4 py-2.5 text-sm"
          />
        </div>

        <div className="overflow-y-auto px-5 pt-4">
          {q.trim().length < 2 && list.length > 0 && <p className="text-muted text-xs mb-2">Недавние и ваши подписки</p>}
          {q.trim().length >= 2 && list.length === 0 && <p className="text-muted text-sm text-center py-3">Никого не нашли.</p>}
          {list.length > 0 && (
            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              {list.map((r) => (
                <button key={r.id} onClick={() => sendTo(r)} className="flex flex-col items-center min-w-0">
                  <span
                    className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] bg-cover bg-center flex items-center justify-center text-white font-semibold"
                    style={r.photoUrl ? { backgroundImage: `url(${r.photoUrl})` } : undefined}
                  >
                    {!r.photoUrl && r.name.slice(0, 1).toUpperCase()}
                    {sent[r.id] === "ok" && (
                      <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-gold text-xl">✓</span>
                    )}
                  </span>
                  <span className="text-offwhite text-[12px] mt-1.5 w-full truncate text-center">{r.name}</span>
                  <span className="text-muted text-[10px] w-full truncate text-center">
                    {busy === r.id ? "..." : sent[r.id] === "ok" ? "Отправлено" : sent[r.id] ? sent[r.id] : r.nick ? `@${r.nick}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-muted/30 mt-5 pt-2">
            <button
              onClick={() => {
                if (typeof navigator !== "undefined" && "share" in navigator) navigator.share({ title: "VETOKS", url }).catch(() => {});
                else copy();
              }}
              className="w-full flex items-center justify-between py-3.5 text-offwhite text-[15px]"
            >
              <span>Поделиться в других приложениях</span>
              <span className="text-muted">›</span>
            </button>
            <button onClick={copy} className="w-full flex items-center justify-between py-3.5 text-offwhite text-[15px] border-t border-muted/20">
              <span>{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</span>
              <span className="text-muted">⧉</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
