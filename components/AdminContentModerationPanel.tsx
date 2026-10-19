"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

type Item = {
  id: string;
  author: string;
  photo_url: string | null;
  video_url: string | null;
  extra_media: { kind: string; url: string }[] | null;
  caption: string | null;
  submitted_at: string;
  mod_reason: string | null;
};

// CRM → «Проверка контента» (18+): публикации на проверке, недавние, режим «сначала проверка».
export default function AdminContentModerationPanel() {
  const [kind, setKind] = useState<"pending" | "recent">("pending");
  const [items, setItems] = useState<Item[] | null>(null);
  const [mode, setMode] = useState<"before" | "after">("after");
  const [needSql, setNeedSql] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  async function load(k = kind) {
    setItems(null);
    const r = await apiPost("/api/admin/content-moderation", { action: "list", kind: k, countryId: getCrmCountry() || undefined });
    setNeedSql(!!r?.needSql);
    setItems(r?.items ?? []);
  }
  useEffect(() => {
    apiPost("/api/admin/content-moderation", { action: "mode_get" }).then((r) => r?.ok && setMode(r.mode));
  }, []);
  useEffect(() => {
    load(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function setStatus(id: string, status: "ok" | "hidden") {
    if (status === "hidden" && !confirm("Скрыть публикацию у всех? Автор получит уведомление.")) return;
    setBusy(id);
    const r = await apiPost("/api/admin/content-moderation", { action: "set", postId: id, status });
    setBusy("");
    if (r?.ok) setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
    else setMsg("Не получилось. Попробуйте ещё раз.");
  }

  async function toggleMode() {
    const next = mode === "before" ? "after" : "before";
    const r = await apiPost("/api/admin/content-moderation", { action: "mode_set", mode: next });
    if (r?.ok) setMode(r.mode);
    else setMsg("Менять режим может только владелец.");
  }

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <div className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col gap-2">
        <p className="text-offwhite text-sm font-semibold">Режим проверки новых публикаций</p>
        <p className="text-muted text-xs">
          {mode === "before"
            ? "Сейчас: сначала проверка. Новые публикации видны только автору, пока вы их не одобрите."
            : "Сейчас: публикуется сразу. На проверку попадает только то, что отметил автоматический фильтр или на что пожаловались трое людей."}
        </p>
        <button onClick={toggleMode} className="self-start border border-gold text-gold rounded-lg px-4 py-2 text-sm">
          {mode === "before" ? "Включить «публикуется сразу»" : "Включить «сначала проверка»"}
        </button>
      </div>

      <div className="flex gap-2">
        {(["pending", "recent"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 rounded-full py-2 text-sm border ${kind === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}
          >
            {k === "pending" ? "На проверке" : "Недавние"}
          </button>
        ))}
      </div>

      {msg && <p className="text-danger text-xs">{msg}</p>}
      {needSql && <p className="text-danger text-xs">Нужно выполнить SQL для модерации (он есть в сообщении).</p>}
      {items === null && <p className="text-muted text-sm">Загрузка...</p>}
      {items && items.length === 0 && !needSql && (
        <p className="text-muted text-sm">{kind === "pending" ? "На проверке ничего нет 🎉" : "Недавних публикаций нет."}</p>
      )}

      {(items ?? []).map((it) => {
        const media = [
          ...(it.photo_url ? [{ kind: "photo", url: it.photo_url }] : []),
          ...(it.video_url ? [{ kind: "video", url: it.video_url }] : []),
          ...((it.extra_media ?? []) as { kind: string; url: string }[]),
        ];
        return (
          <div key={it.id} className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col gap-2">
            <p className="text-offwhite text-sm font-semibold">
              {it.author} <span className="text-muted font-normal text-xs">· {new Date(it.submitted_at).toLocaleString("ru-RU")}</span>
            </p>
            {it.mod_reason && <p className="text-danger text-xs">Причина: {it.mod_reason}</p>}
            {it.caption && <p className="text-offwhite text-xs">{it.caption}</p>}
            <div className="flex gap-2 overflow-x-auto">
              {media.slice(0, 6).map((m, i) =>
                m.kind === "video" ? (
                  <video key={i} src={m.url} controls preload="metadata" className="h-48 rounded-lg bg-black flex-none" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={m.url} alt="" className="h-48 rounded-lg flex-none object-cover" />
                )
              )}
            </div>
            <div className="flex gap-2">
              {kind === "pending" && (
                <button
                  onClick={() => setStatus(it.id, "ok")}
                  disabled={busy === it.id}
                  className="flex-1 border border-gold text-gold rounded-full py-2 text-sm disabled:opacity-50"
                >
                  Одобрить
                </button>
              )}
              <button
                onClick={() => setStatus(it.id, "hidden")}
                disabled={busy === it.id}
                className="flex-1 bg-danger text-white rounded-full py-2 text-sm disabled:opacity-50"
              >
                Скрыть (18+)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
