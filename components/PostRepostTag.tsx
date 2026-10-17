"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { IconRepost, IconTagTab } from "@/components/ProfileIcons";

type Found = { nick: string; name: string; photoUrl: string | null; isParticipant: boolean };

// Кнопки «Репост» (для всех, кроме автора) и «Отметить» (для автора) в просмотре фото и видео.
export default function PostRepostTag({
  postId,
  ownerUserId,
  meId,
  compact = false,
  initialReposted = false,
  noButton = false,
  externalOpen = false,
  onExternalClose,
}: {
  postId: string;
  ownerUserId: string | null;
  meId: string | null;
  compact?: boolean;
  initialReposted?: boolean;
  noButton?: boolean;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}) {
  const [reposted, setReposted] = useState(initialReposted);
  const [openLocal, setOpen] = useState(false);
  const open = openLocal || externalOpen;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    const nick = q.trim().replace(/^@/, "").toLowerCase();
    if (nick.length < 2) {
      setFound([]);
      return;
    }
    const h = setTimeout(async () => {
      const r = await apiPost("/api/profile/search", { q: nick });
      setFound(r?.ok ? r.items : []);
    }, 250);
    return () => clearTimeout(h);
  }, [q, open]);

  function closeModal() {
    setOpen(false);
    onExternalClose?.();
  }

  if (!meId || !ownerUserId) return null;
  const isOwner = meId === ownerUserId;

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 2500);
  }

  async function repost() {
    const on = !reposted;
    const r = await apiPost("/api/profile/repost", { postId, on });
    if (r?.ok) {
      setReposted(r.on);
      flash(r.on ? "Добавлено в ваши «Репосты»" : "Репост убран");
    } else flash("Не получилось. Попробуйте ещё раз.");
  }

  async function tag(nick: string) {
    const r = await apiPost("/api/profile/tags", { action: "tag", postId, nick });
    if (r?.ok) {
      flash(r.already ? "Этого человека уже отметили." : r.status === "pending" ? "Отправлено на подтверждение." : "Человек отмечен.");
      closeModal();
      setQ("");
    } else flash(r?.error === "too_many" ? "Можно отметить не больше 10 человек." : "Не получилось отметить.");
  }

  return (
    <>
      {noButton ? null : isOwner ? (
        <button onClick={() => setOpen(true)} className="flex flex-col items-center text-white" aria-label="Отметить человека">
          <IconTagTab size={compact ? 26 : 28} />
          {!compact && <span className="text-[10px] mt-0.5">Отметить</span>}
        </button>
      ) : (
        <button onClick={repost} className={`flex flex-col items-center ${reposted ? "text-[#E8D48A]" : "text-white"}`} aria-label="Репост">
          <IconRepost size={compact ? 26 : 28} />
          {!compact && <span className="text-[10px] mt-0.5">{reposted ? "В репостах" : "Репост"}</span>}
        </button>
      )}

      {msg && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">{msg}</div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={closeModal}>
          <div className="bg-bgSurface w-full max-h-[70vh] rounded-t-2xl p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-offwhite font-semibold">Отметить человека</span>
              <button onClick={closeModal} className="text-muted text-xl" aria-label="Закрыть">
                ✕
              </button>
            </div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ник, например anna_kov"
              className="bg-bgPrimary text-offwhite border border-muted rounded-full px-4 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto flex flex-col">
              {found.map((f) => (
                <button key={f.nick} onClick={() => tag(f.nick)} className="flex items-center gap-3 py-2 text-left border-t border-muted/30">
                  <span className="w-9 h-9 rounded-full bg-black/40 overflow-hidden flex-none">
                    {f.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.photoUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </span>
                  <span className="text-offwhite text-sm">
                    {f.name}
                    <span className="block text-muted text-xs">@{f.nick}{f.isParticipant ? " · участница" : ""}</span>
                  </span>
                </button>
              ))}
              {q.trim().length >= 2 && found.length === 0 && <p className="text-muted text-sm text-center py-4">Никого не нашли.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
