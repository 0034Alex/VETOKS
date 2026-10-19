"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";

const MSG: Record<string, string> = {
  bad_words: "Есть недопустимые слова. Перепишите без грубостей.",
  links: "Ссылки и адреса писать нельзя.",
  long: "Слишком длинно (до 500 символов).",
  muted: "Вам временно запрещено писать.",
  empty: "Напишите текст.",
};

// Кнопки «Изменить» и «Удалить» для своего текста (комментарий или сообщение в клане) и окошко правки.
// api — адрес сервера, id — номер записи. После правки или удаления вызывается onDone.
export default function OwnTextActions({
  api,
  id,
  body,
  onDone,
  light,
  children,
}: {
  api: string;
  id: string;
  body: string;
  onDone: (kind: "edit" | "delete") => void;
  light?: boolean; // кнопки на золотом фоне (свои сообщения в клане)
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cls = light ? "text-bgPrimary/70" : "text-muted";

  async function save() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setErr("");
    const r = await apiPost(api, { action: "edit", id, text });
    setBusy(false);
    if (r?.ok) {
      setEditing(false);
      onDone("edit");
    } else setErr(MSG[r?.error as string] ?? "Не получилось. Попробуйте ещё раз.");
  }

  async function del() {
    if (busy || !confirm("Удалить? Это нельзя отменить.")) return;
    setBusy(true);
    const r = await apiPost(api, { action: "delete", id });
    setBusy(false);
    if (r?.ok) onDone("delete");
    else setErr("Не получилось удалить. Попробуйте ещё раз.");
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-1.5 text-sm"
        />
        <div className="flex gap-3 text-xs">
          <button onClick={save} disabled={busy || !text.trim()} className="text-gold font-semibold disabled:opacity-40">
            Сохранить
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setText(body);
              setErr("");
            }}
            className="text-muted"
          >
            Отмена
          </button>
        </div>
        {err && <p className="text-danger text-xs">{err}</p>}
      </div>
    );
  }

  return (
    <>
      {children}
      <span className={`flex gap-3 text-[10px] mt-0.5 ${cls}`}>
        <button
          onClick={() => {
            setText(body);
            setEditing(true);
          }}
          className="underline"
        >
          Изменить
        </button>
        <button onClick={del} disabled={busy} className="underline">
          Удалить
        </button>
      </span>
      {err && <span className="block text-danger text-[10px]">{err}</span>}
    </>
  );
}
