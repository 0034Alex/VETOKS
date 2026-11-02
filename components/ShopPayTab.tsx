"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const ERR: Record<string, string> = {
  bad_tg: "Telegram-ник: 4–32 символа, латиница, цифры и _ (например @ivan_shop).",
  no_manager: "Сначала укажите менеджера.",
};

// Реквизиты магазина и менеджер, которому в Telegram приходят заказы.
export default function ShopPayTab() {
  const [d, setD] = useState<any>(null);
  const [pay, setPay] = useState("");
  const [mgr, setMgr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  function apply(r: any) {
    setD(r);
    setPay(r.pay_text ?? "");
    setMgr(r.manager?.name ? (r.manager.bound ? r.manager.name : "@" + String(r.manager.name).replace(/^@/, "")) : "");
  }
  async function load() {
    const r = await apiPost("/api/business/settings", { action: "get" });
    if (r?.ok) apply(r);
  }
  useEffect(() => {
    load();
  }, []);

  async function call(body: Record<string, any>, ok = "Сохранено") {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/settings", body);
    setBusy(false);
    if (r?.ok && !r.unavailable) {
      apply(r);
      setMsg(ok);
    } else setMsg(ERR[r?.error] ?? "Не получилось. Попробуйте ещё раз.");
  }

  if (!d) return <p className="text-muted text-sm">Загрузка...</p>;
  if (d.unavailable) return <p className="text-muted text-sm">Раздел ещё настраивается. Попробуйте позже.</p>;
  const m = d.manager ?? {};
  const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  const changed = mgr.trim().replace(/^@/, "") !== String(m.name ?? "").replace(/^@/, "");

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-2">
        <p className="text-offwhite font-semibold text-sm">Реквизиты для оплаты</p>
        <p className="text-muted text-xs">Вносятся один раз. Когда вы одобряете заказ, покупатель сам получает счёт с этими реквизитами и платит напрямую вам.</p>
        <textarea value={pay} onChange={(e) => setPay(e.target.value)} rows={4} maxLength={600} placeholder="Например: карта Mono 5375 ... ... ... , Иванов И. Или ссылка на банку / LiqPay" className={input} />
        <button disabled={busy} onClick={() => call({ action: "save", pay_text: pay })} className="bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">Сохранить реквизиты</button>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-2">
        <p className="text-offwhite font-semibold text-sm">Менеджер заказов в Telegram</p>
        <p className="text-muted text-xs">Новые заказы, оплаты и возвраты приходят менеджеру в Telegram с кнопками «Одобрить», «Деньги получил», «Отправлено». Его работа видна во вкладке «Учёт».</p>
        {m.noBot && <p className="text-danger text-xs">Для вашей страны ещё не подключён Telegram-бот. Напишите в поддержку.</p>}
        <input value={mgr} onChange={(e) => setMgr(e.target.value)} placeholder="@ник менеджера в Telegram" maxLength={60} className={input} />
        {m.name && m.bound && !changed && <p className="text-success text-xs">✅ Подключён: {m.name}</p>}
        {m.name && !m.bound && !changed && (
          <div className="text-xs text-muted flex flex-col gap-1.5">
            <p className="text-gold">⏳ Ждём менеджера. Отправьте ему эту ссылку, он должен открыть её и нажать «Старт»:</p>
            {m.link ? (
              <>
                <p className="text-offwhite break-all bg-bgPrimary rounded-lg p-2">{m.link}</p>
                <button onClick={() => { try { navigator.clipboard.writeText(m.link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }} className="self-start border border-gold text-gold rounded-full px-3 py-1.5 text-xs">{copied ? "Скопировано" : "Скопировать ссылку"}</button>
              </>
            ) : null}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button disabled={busy || !changed} onClick={() => call({ action: "save", manager: mgr }, mgr.trim() ? "Сохранено. Отправьте менеджеру ссылку." : "Менеджер убран")} className="bg-gold text-bgPrimary font-semibold rounded-full px-4 py-2 text-sm disabled:opacity-50">{mgr.trim() ? "Сохранить и получить ссылку" : "Убрать менеджера"}</button>
          {m.name && !changed && (
            <>
              {!m.bound && <button disabled={busy} onClick={() => call({ action: "regen" }, "Новая ссылка готова")} className="border border-muted text-offwhite rounded-full px-4 py-2 text-sm">Новая ссылка</button>}
              <button disabled={busy} onClick={() => call({ action: "unlink" }, "Менеджер отключён")} className="text-danger text-xs underline">Отключить</button>
            </>
          )}
        </div>
        {msg && <p className="text-muted text-xs">{msg}</p>}
      </div>
    </div>
  );
}
