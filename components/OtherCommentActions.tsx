"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";
import ReportSheet from "@/components/ReportSheet";

// Под чужим комментарием: «Пожаловаться», а владельцу публикации ещё и «Удалить».
export default function OtherCommentActions({
  commentId,
  canDelete,
  loggedIn,
  onDeleted,
}: {
  commentId: string;
  canDelete: boolean;
  loggedIn: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    if (busy || !confirm("Удалить этот комментарий у себя под публикацией?")) return;
    setBusy(true);
    const r = await apiPost("/api/comments/manage", { action: "delete", id: commentId });
    setBusy(false);
    if (r?.ok) onDeleted();
    else alert("Не получилось удалить. Попробуйте ещё раз.");
  }

  return (
    <>
      <span className="flex gap-3 text-[10px] mt-0.5 text-muted">
        <button
          onClick={() => {
            if (!loggedIn) window.location.href = "/login";
            else setOpen(true);
          }}
          disabled={sent}
          className="underline disabled:no-underline"
        >
          {sent ? "Жалоба отправлена" : "Пожаловаться"}
        </button>
        {canDelete && (
          <button onClick={del} disabled={busy} className="underline">
            Удалить
          </button>
        )}
      </span>
      <ReportSheet
        open={open}
        onClose={() => {
          setOpen(false);
          setSent(true);
        }}
        target={{ type: "comment", commentId }}
      />
    </>
  );
}
