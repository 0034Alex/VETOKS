"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiPost, openSession } from "@/lib/authClient";

type Acc = { id: string; name: string; main: boolean; current: boolean; business?: boolean };
const kind = (a: Acc) => (a.business ? "Бизнес" : a.main ? "Основной" : "Дополнительный");

// Переключатель «Мои аккаунты» в профиле.
export default function AccountSwitcher({ chip = false }: { chip?: boolean }) {
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [canAdd, setCanAdd] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [canBiz, setCanBiz] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function load() {
    const r = await apiPost("/api/accounts/list");
    if (r.status === "ok") {
      // Порядок: основной, бизнес, дополнительные.
      const rank = (a: Acc) => (a.main ? 0 : a.business ? 1 : 2);
      setAccounts([...(r.accounts as Acc[])].sort((a, b) => rank(a) - rank(b)));
      setCanBiz(!!r.canCreateBusiness);
      setCanAdd(!!r.canAdd);
      setNeedVerify(!!r.needVerify);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function enter(tokenHash: string) {
    if (await openSession(tokenHash)) {
      window.location.replace("/profile");
    } else {
      setBusy(false);
      setMsg("Не удалось переключиться. Попробуйте ещё раз.");
    }
  }

  async function switchTo(id: string) {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/accounts/switch", { targetId: id });
    if (r.status === "ok") await enter(r.token_hash);
    else {
      setBusy(false);
      setMsg(r.message || "Не удалось переключиться.");
    }
  }

  async function createBiz() {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/enable");
    if (r?.ok && r.token_hash) await enter(r.token_hash);
    else {
      setBusy(false);
      setMsg(r?.error === "need_phone" ? "Сначала подтвердите номер телефона в основном аккаунте." : r?.error === "no_slot" ? "Нет свободного места под бизнес-аккаунт." : "Не получилось создать бизнес-аккаунт.");
    }
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/accounts/create", { firstName: name.trim() });
    if (r.status === "ok") await enter(r.token_hash);
    else {
      setBusy(false);
      setMsg(r.message || "Не удалось создать аккаунт.");
    }
  }

  // Пока аккаунт один и добавить нельзя — не загромождаем профиль.
  if (accounts.length <= 1 && !canAdd && !canBiz) return null;

  const current = accounts.find((a) => a.current);

  return (
    <>
      {chip ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-offwhite px-3 py-1.5 rounded-full bg-black/45 backdrop-blur border border-white/15"
        >
          <span className="text-gold">⇄</span>
          {current?.business ? "🏪 " : ""}{current?.name ?? "Аккаунт"}
        </button>
      ) : (
      <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 bg-bgSurface border border-muted rounded-xl px-4 py-3 mb-4 text-left"
        >
          <span className="text-sm text-offwhite">
            <span className="text-muted text-xs block">Мои аккаунты</span>
            {current?.name ?? "Аккаунт"}
            {current && <span className="text-muted text-xs"> · {kind(current).toLowerCase()}</span>}
          </span>
          <span className="text-gold text-lg">⇄</span>
        </button>
  
      )}

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/70 flex items-end justify-center"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-offwhite font-semibold">Мои аккаунты</p>
              <button onClick={() => setOpen(false)} className="text-muted text-xl">✕</button>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  disabled={busy || a.current}
                  onClick={() => switchTo(a.id)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border text-left ${
                    a.current ? "border-gold bg-gold/10" : "border-muted"
                  }`}
                >
                  <span className="text-offwhite text-sm">
                    {a.name}
                    <span className="text-muted text-xs block">{kind(a)}</span>
                  </span>
                  {a.current && <span className="text-gold text-xs">сейчас</span>}
                </button>
              ))}
            </div>

            {canBiz && !adding && (
              <button
                onClick={createBiz}
                disabled={busy}
                className="w-full mb-2 bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50"
              >
                {busy ? "Создаём..." : "🏪 Создать бизнес-аккаунт"}
              </button>
            )}

            {adding ? (
              <div className="flex flex-col gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Имя нового аккаунта"
                  maxLength={60}
                  className="bg-bgPrimary border border-muted rounded-full px-4 py-2.5 text-sm text-offwhite"
                />
                <button
                  onClick={create}
                  disabled={busy || !name.trim()}
                  className="bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50"
                >
                  {busy ? "Создаём..." : "Создать и перейти"}
                </button>
              </div>
            ) : canAdd ? (
              <button
                onClick={() => setAdding(true)}
                className="w-full border border-gold text-gold font-semibold rounded-full py-2.5 text-sm"
              >
                + Добавить аккаунт
              </button>
            ) : needVerify ? (
              <p className="text-muted text-xs">Чтобы добавить аккаунт, подтвердите номер в основном аккаунте.</p>
            ) : (
              <p className="text-muted text-xs">Достигнут максимум — 3 аккаунта.</p>
            )}

            {msg && <p className="text-danger text-xs mt-2">{msg}</p>}
            <p className="text-muted text-[11px] mt-3">
              У каждого аккаунта свой баланс, подарки и данные. Вход один — по вашему Telegram. В шоу может участвовать только один из ваших аккаунтов.
            </p>
          </div>
        </div>
      , document.body)}
    </>
  );
}
