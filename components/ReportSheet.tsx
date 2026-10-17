"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

export type ReportTarget =
  | { type: "post"; postId: string }
  | { type: "dm"; userId: string }
  | { type: "clan"; messageId: string };

// Причины жалоб: одинаковые по всему приложению.
export const REPORT_REASONS: { key: string; title: string; hint: string }[] = [
  { key: "spam", title: "Спам или реклама", hint: "Навязчивая реклама, ссылки, рассылки" },
  { key: "nudity", title: "Обнажённость или сексуальный контент", hint: "Откровенные фото, видео, сообщения" },
  { key: "violence", title: "Насилие или опасные действия", hint: "Драки, угрозы, жестокость" },
  { key: "hate", title: "Оскорбления, травля, язык вражды", hint: "Унижение, преследование, дискриминация" },
  { key: "scam", title: "Мошенничество или обман", hint: "Выманивают деньги или данные" },
  { key: "fake", title: "Фейк или выдача себя за другого", hint: "Чужое фото или видео, поддельный профиль" },
  { key: "minor", title: "Опасно для детей", hint: "Контент с несовершеннолетними, их безопасность" },
  { key: "illegal", title: "Запрещённые товары и действия", hint: "Наркотики, оружие, незаконные услуги" },
  { key: "selfharm", title: "Самоповреждение или суицид", hint: "Человеку может быть нужна помощь" },
  { key: "ip", title: "Нарушение авторских прав", hint: "Использовано чужое без разрешения" },
  { key: "other", title: "Другое", hint: "Опишите своими словами" },
];

const TITLES: Record<ReportTarget["type"], string> = {
  post: "Пожаловаться на публикацию",
  dm: "Пожаловаться на переписку",
  clan: "Пожаловаться на сообщение",
};

// Окно жалобы: сначала выбираешь причину, потом по желанию описываешь своими словами.
export default function ReportSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: ReportTarget }) {
  const [step, setStep] = useState<"pick" | "details" | "done">("pick");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setStep("pick");
      setReason("");
      setDetails("");
      setErr("");
      setSending(false);
    }
  }, [open]);

  if (!open) return null;
  const picked = REPORT_REASONS.find((r) => r.key === reason);

  async function send() {
    if (reason === "other" && details.trim().length < 5) {
      setErr("Опишите, что не так, хотя бы в паре слов.");
      return;
    }
    setSending(true);
    setErr("");
    const body = { reason, details: details.trim().slice(0, 500) };
    const r =
      target.type === "post"
        ? await apiPost("/api/reports/create", { postId: target.postId, ...body })
        : target.type === "dm"
        ? await apiPost("/api/dm/action", { action: "report", userId: target.userId, ...body })
        : await apiPost("/api/clan/report", { messageId: target.messageId, ...body });
    setSending(false);
    if (r?.ok) setStep("done");
    else setErr("Не получилось отправить. Попробуйте ещё раз.");
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
        <div className="flex items-center gap-3 px-5 pt-3 pb-3 border-b border-muted/30">
          {step === "details" && (
            <button onClick={() => setStep("pick")} className="text-offwhite text-xl leading-none" aria-label="Назад">
              ←
            </button>
          )}
          <p className="text-offwhite font-semibold flex-1 text-center">{step === "done" ? "Жалоба отправлена" : TITLES[target.type]}</p>
          <button onClick={onClose} className="text-muted text-xl leading-none" aria-label="Закрыть">
            ✕
          </button>
        </div>

        {step === "pick" && (
          <div className="overflow-y-auto">
            <p className="px-5 pt-4 pb-1 text-offwhite text-[15px] font-semibold">Почему вы жалуетесь?</p>
            <p className="px-5 pb-2 text-muted text-xs">Ваша жалоба анонимна: автор не узнает, кто её отправил.</p>
            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setReason(r.key);
                  setStep("details");
                }}
                className="w-full flex items-center gap-3 px-5 py-3 text-left border-t border-muted/20"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-offwhite text-sm">{r.title}</span>
                  <span className="block text-muted text-xs mt-0.5">{r.hint}</span>
                </span>
                <span className="text-muted">›</span>
              </button>
            ))}
          </div>
        )}

        {step === "details" && (
          <div className="px-5 pt-4 overflow-y-auto">
            <p className="text-offwhite text-sm font-semibold">{picked?.title}</p>
            <p className="text-muted text-xs mt-0.5 mb-3">{picked?.hint}</p>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder={reason === "other" ? "Опишите, что именно вам не понравилось" : "Расскажите подробнее (необязательно): что вы заметили, почему это нарушение"}
              className="w-full bg-bgPrimary text-offwhite border border-muted rounded-xl px-3 py-2.5 text-sm"
            />
            <p className="text-muted text-[11px] text-right mt-1">{details.length} / 500</p>
            {err && <p className="text-danger text-sm mt-1">{err}</p>}
            <button
              onClick={send}
              disabled={sending}
              className="w-full mt-3 bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
            >
              {sending ? "Отправляем..." : "Отправить жалобу"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-3">🛡</div>
            <p className="text-offwhite text-[15px] font-semibold mb-1.5">Спасибо, что помогаете делать VETOKS безопаснее</p>
            <p className="text-muted text-sm mb-5">Модератор проверит жалобу. Если нарушение подтвердится, мы примем меры.</p>
            <button onClick={onClose} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full">
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
