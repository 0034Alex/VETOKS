"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";

export const SHOP_REPORT_REASONS: { key: string; title: string; hint: string }[] = [
  { key: "not_shipped", title: "Не отправили товар", hint: "Оплатил(а), а товар не пришёл или магазин пропал" },
  { key: "not_as_described", title: "Товар не соответствует описанию", hint: "Другое качество, размер, цвет, состав" },
  { key: "fraud", title: "Мошенничество", hint: "Обманом выманивают деньги или данные" },
  { key: "no_refund", title: "Не возвращают деньги", hint: "Отказ вернуть оплату за отменённый заказ" },
  { key: "price_changed", title: "Цена или условия изменились после заказа", hint: "Просят доплатить, подменили условия" },
  { key: "rude", title: "Грубое или недобросовестное общение", hint: "Хамство, угрозы, игнорируют сообщения" },
  { key: "fake_goods", title: "Подделка или запрещённый товар", hint: "Копии брендов, незаконные товары и услуги" },
  { key: "false_info", title: "Ложная информация на странице", hint: "Неправда в описании, адресе, контактах" },
  { key: "spam", title: "Спам или навязчивая реклама", hint: "Лишние рассылки, ссылки" },
  { key: "other", title: "Другое", hint: "Опишите своими словами" },
];

// Жалоба на магазин: выбираешь причину и можешь дописать свою.
export default function ShopReportSheet({ open, onClose, businessId }: { open: boolean; onClose: () => void; businessId: string }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  function close() {
    if (busy) return;
    onClose();
    setTimeout(() => {
      setReason("");
      setDetails("");
      setErr("");
      setDone(false);
    }, 300);
  }

  async function send() {
    if (!reason) return;
    if (reason === "other" && !details.trim()) return setErr("Опишите, что случилось.");
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/report", { id: businessId, reason, details });
    setBusy(false);
    if (r?.ok) setDone(true);
    else setErr("Не получилось отправить. Попробуйте ещё раз.");
  }

  return (
    <div className="fixed inset-0 z-[160] bg-black/70 flex items-end justify-center" onClick={close}>
      <div className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5 max-h-[88dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <p className="text-offwhite font-semibold mb-2">Спасибо, жалоба отправлена</p>
            <p className="text-muted text-sm mb-4">Мы проверим магазин и примем решение.</p>
            <button onClick={close} className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">Готово</button>
          </>
        ) : (
          <>
            <p className="text-offwhite font-semibold mb-3">Пожаловаться на магазин</p>
            <div className="flex flex-col gap-2">
              {SHOP_REPORT_REASONS.map((r) => (
                <button key={r.key} onClick={() => setReason(r.key)} className={`text-left rounded-xl px-4 py-2.5 border ${reason === r.key ? "border-gold bg-gold/10" : "border-muted"}`}>
                  <span className="text-offwhite text-sm block">{r.title}</span>
                  <span className="text-muted text-xs">{r.hint}</span>
                </button>
              ))}
            </div>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} placeholder={reason === "other" ? "Опишите, что случилось *" : "Что произошло (по желанию)"} className="w-full bg-bgPrimary border border-muted rounded-xl px-3 py-2 text-sm text-offwhite mt-3" />
            {err && <p className="text-danger text-xs mt-2">{err}</p>}
            <button onClick={send} disabled={!reason || busy} className="w-full mt-3 bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">{busy ? "Отправляем..." : "Отправить"}</button>
          </>
        )}
      </div>
    </div>
  );
}
