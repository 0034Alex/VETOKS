"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";
import CoinIcon from "@/components/CoinIcon";

// Окно «Обменять Короны на монеты». Только в одну сторону.
export default function ExchangeSheet({
  open,
  onClose,
  crowns,
  coinsPerCrown,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  crowns: number;
  coinsPerCrown: number;
  onDone: () => void;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!open) return null;
  const n = Number(val);
  const ok = isFinite(n) && n > 0 && n <= crowns;

  async function go() {
    if (!ok || busy) return;
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/wallet/exchange", { crowns: n });
    setBusy(false);
    if (r?.ok) {
      setVal("");
      setMsg(`Готово! +${Math.round(r.coins)} монет`);
      onDone();
    } else setMsg(r?.error === "not_enough" ? "Не хватает Корон." : r?.error === "disabled" ? "Обмен сейчас выключен." : "Не получилось обменять.");
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-offwhite font-semibold text-lg">Обмен Корон на монеты</p>
          <button onClick={onClose} className="text-muted text-2xl leading-none px-2" aria-label="Закрыть">×</button>
        </div>
        <p className="text-muted text-sm mb-1">У вас {Math.round(crowns * 100) / 100} Корон. 1 Корона = {Math.round(coinsPerCrown * 100) / 100} монет.</p>
        <p className="text-muted text-xs mb-4">Обмен только в одну сторону: монеты обратно в Короны превратить нельзя.</p>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Сколько Корон"
            className="flex-1 min-w-0 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite"
          />
          <button onClick={() => setVal(String(crowns))} className="text-gold text-xs underline">Все</button>
        </div>
        {ok && (
          <p className="text-offwhite text-sm mt-3 flex items-center gap-2">
            Получите <CoinIcon size={18} /> <b>{Math.round(n * coinsPerCrown)}</b>
          </p>
        )}
        <button disabled={!ok || busy} onClick={go} className="w-full h-12 rounded-xl bg-gold text-bgPrimary font-semibold text-sm mt-4 disabled:opacity-40">
          {busy ? "Обмениваем…" : "Обменять"}
        </button>
        {msg && <p className="text-gold text-sm text-center mt-3">{msg}</p>}
      </div>
    </div>
  );
}
