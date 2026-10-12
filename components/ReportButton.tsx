"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";

const REASONS: [string, string][] = [
  ["spam", "Спам или реклама"],
  ["nudity", "Неприемлемое содержание"],
  ["violence", "Насилие или оскорбления"],
  ["fake", "Чужое видео / обман"],
  ["other", "Другое"],
];

// Кнопка «Пожаловаться» для колонки справа в ленте.
export default function ReportButton({ postId, loggedIn }: { postId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send() {
    setState("sending");
    const r = await apiPost("/api/reports/create", { postId, reason, details });
    setState(r?.ok ? "done" : "error");
  }

  return (
    <>
      <button
        onClick={() => {
          if (!loggedIn) {
            window.location.href = "/login";
            return;
          }
          setState("idle");
          setOpen(true);
        }}
        className="flex flex-col items-center"
      >
        <span className="text-white text-xl leading-none">⚑</span>
        <span className="text-white text-[10px] mt-0.5">Жалоба</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100dvh",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-bgSurface border border-muted rounded-2xl p-5 w-full max-w-sm relative"
            style={{ maxHeight: "85dvh", overflowY: "auto" }}
          >
            <button onClick={() => setOpen(false)} className="absolute top-2 right-3 text-muted text-xl">
              ✕
            </button>
            {state === "done" ? (
              <p className="text-offwhite text-center py-6">Спасибо! Жалоба отправлена модератору.</p>
            ) : (
              <>
                <h3 className="text-offwhite font-semibold mb-3">Пожаловаться на ролик</h3>
                <div className="flex flex-col gap-2 mb-3">
                  {REASONS.map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-offwhite text-sm">
                      <input type="radio" checked={reason === k} onChange={() => setReason(k)} />
                      {label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={2}
                  placeholder="Пояснение (необязательно)"
                  className="w-full bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-2 text-sm mb-3"
                />
                {state === "error" && <p className="text-danger text-sm mb-2">Не получилось отправить, попробуйте ещё раз.</p>}
                <button
                  onClick={send}
                  disabled={state === "sending"}
                  className="w-full bg-gold text-bgPrimary font-semibold py-2.5 rounded-full disabled:opacity-50"
                >
                  {state === "sending" ? "Отправляем..." : "Отправить"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
