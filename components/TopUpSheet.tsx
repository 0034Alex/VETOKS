"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import CoinIcon from "@/components/CoinIcon";

type Info = {
  coins: number;
  symbol: string;
  coinsPerUnit: number;
  packs: { coins: number; price: number; bonus: number }[];
  topupMin: number;
  topupMax: number;
  customBonusPct: number;
  bonusOn: boolean;
  bonusUntil: string | null;
};

function useLeft(until: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  const s = Math.floor(ms / 1000);
  return { done: ms <= 0, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

// Окно «Пополнить монеты»: пакеты, своя сумма, бонус первой покупки с таймером.
export default function TopUpSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: (balance: number) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [testOn, setTestOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState("");
  const left = useLeft(info?.bonusOn ? info.bonusUntil : null);

  async function load() {
    const [r, t] = await Promise.all([apiPost("/api/wallet/info"), apiPost("/api/shop/test-topup", { check: true })]);
    if (r?.ok) setInfo(r as Info);
    setTestOn(!!(t?.ok && t.enabled));
  }

  useEffect(() => {
    if (open) {
      setMsg("");
      setAmount("");
      load();
    }
  }, [open]);

  if (!open) return null;
  const bonusLive = !!info?.bonusOn && !(left && left.done);

  async function buy(body: object) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/shop/test-topup", body);
    setBusy(false);
    if (r?.ok) {
      setMsg(`Готово! +${Math.round(r.coins + (r.bonus || 0))} монет`);
      onDone?.(Number(r.balance));
      load();
    } else if (r?.error === "out_of_range") setMsg(`Сумма от ${r.min} до ${r.max}`);
    else if (r?.error === "need_parent") setMsg("Нужно согласие родителя.");
    else setMsg("Пополнение сейчас недоступно.");
  }

  const num = Number(amount);
  const customCoins = info && isFinite(num) && num > 0 ? Math.floor(num * info.coinsPerUnit) : 0;
  const customBonus = info && bonusLive ? Math.floor((customCoins * info.customBonusPct) / 100) : 0;
  const customOk = !!info && num >= info.topupMin && num <= info.topupMax;

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-bgSurface rounded-t-3xl max-h-[88dvh] overflow-y-auto p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-offwhite font-semibold text-lg">Пополнить монеты</p>
          <button onClick={onClose} className="text-muted text-2xl leading-none px-2" aria-label="Закрыть">×</button>
        </div>

        {!info ? (
          <p className="text-muted text-sm py-8 text-center">Загрузка…</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 text-offwhite">
              <CoinIcon size={28} />
              <span className="text-2xl font-bold">{Math.round(info.coins)}</span>
              <span className="text-muted text-xs">ваш баланс</span>
            </div>

            {bonusLive && left && (
              <div className="rounded-2xl border border-gold/60 bg-gradient-to-b from-[#1d1a10] to-bgSurface p-4 mb-4 text-center">
                <p className="text-gold font-semibold text-sm">🎁 Бонус на первую покупку</p>
                <div className="flex justify-center gap-1.5 mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {[
                    [left.d, "дн"],
                    [left.h, "ч"],
                    [left.m, "мин"],
                    [left.s, "сек"],
                  ].map(([v, l]) => (
                    <div key={String(l)} className="bg-black border border-gold/40 rounded-lg px-2 py-1 min-w-[44px]">
                      <div className="text-gold font-bold">{String(v).padStart(2, "0")}</div>
                      <div className="text-muted text-[9px]">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-muted text-[11px] mt-2">Бонус только на первое пополнение, потом он сгорает</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {info.packs.map((p, i) => {
                const b = bonusLive ? p.bonus : 0;
                return (
                  <button
                    key={i}
                    disabled={busy || !testOn}
                    onClick={() => buy({ pack: i })}
                    className={`relative rounded-2xl border p-3 flex flex-col items-center gap-1 disabled:opacity-60 ${b > 0 ? "border-gold" : "border-muted/60"}`}
                  >
                    {b > 0 && (
                      <span className="absolute -top-2.5 bg-gradient-to-r from-[#F3E3A0] to-[#D9B54A] text-[#1a1405] text-[10px] font-extrabold rounded-full px-2 py-0.5">
                        +{b} в подарок
                      </span>
                    )}
                    <CoinIcon size={40} />
                    <span className="text-offwhite text-xl font-bold">{p.coins}</span>
                    <span className="bg-gold text-bgPrimary text-xs font-bold rounded-full px-3 py-1 mt-1">
                      {p.price} {info.symbol}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-muted/60 p-3">
              <p className="text-offwhite text-sm mb-2">Своя сумма</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`${info.topupMin}–${info.topupMax}`}
                  className="flex-1 min-w-0 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite"
                />
                <span className="self-center text-muted text-sm">{info.symbol}</span>
                <button
                  disabled={!customOk || busy || !testOn}
                  onClick={() => buy({ amount: num })}
                  className="bg-gold text-bgPrimary font-semibold rounded-lg px-4 text-sm disabled:opacity-40"
                >
                  Купить
                </button>
              </div>
              {customCoins > 0 && (
                <p className="text-muted text-xs mt-2">
                  Получите {customCoins}
                  {customBonus > 0 ? ` + ${customBonus} бонус` : ""} монет
                </p>
              )}
              <p className="text-muted text-[11px] mt-1">
                От {info.topupMin} до {info.topupMax} {info.symbol}
              </p>
            </div>

            {!testOn && <p className="text-muted text-xs text-center mt-4">Оплата картой скоро появится.</p>}
            {testOn && <p className="text-muted text-[11px] text-center mt-3">Тестовый режим — реальные деньги пока не подключены.</p>}
            {msg && <p className="text-gold text-sm text-center mt-3">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
