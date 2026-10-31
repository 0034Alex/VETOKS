"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { statusInfo, money, GIFT_STEPS, GIFT_STATUS } from "@/lib/businessShared";

// Один заказ или подарок: детали, статусы и чат. Для покупателя, партнёра и получательницы подарка.
export default function BusinessOrderThread({ id, cur, onBack, onChanged }: { id: string; cur: string; onBack: () => void; onChanged?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [text, setText] = useState("");
  const [chan, setChan] = useState<"main" | "recipient">("main");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const r = await apiPost("/api/business/orders", { action: "get", id });
    if (r?.ok) setD(r);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [d?.messages?.length, chan]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/orders", { action: "send", id, body: text, channel: chan });
    setBusy(false);
    if (r?.ok) {
      setText("");
      load();
    } else setErr(r?.error === "not_accepted" ? "Чат с получателем откроется, когда он примет подарок." : "Не отправилось. Попробуйте ещё раз.");
  }

  async function setStatus(st: string, ask?: string) {
    if (ask && !window.confirm(ask)) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/orders", { action: "status", id, status: st });
    setBusy(false);
    if (r?.ok) {
      await load();
      onChanged?.();
    } else setErr("Не получилось сменить статус.");
  }

  if (!d) return <p className="text-muted text-sm">Загрузка...</p>;
  const o = d.order;
  const role: "owner" | "buyer" | "recipient" = d.role;
  const gift = o.kind === "gift";
  const st = statusInfo(o.kind, o.status);
  const closed = ["done", "cancelled", "received", "declined"].includes(o.status);

  // Кнопки действий
  const actions: [string, string, string?][] = [];
  if (!gift && role === "owner") {
    if (o.status === "new") actions.push(["confirmed", "Подтвердить"]);
    if (o.status === "confirmed") actions.push(["shipped", o.kind === "book" ? "Бронь состоялась" : "Отправлено"], ["done", "Выполнен"]);
    if (o.status === "shipped") actions.push(["done", "Выполнен"]);
  }
  if (gift && role === "owner") {
    if (o.status === "new") actions.push(["paid", "Оплату получил"]);
    if (o.status === "accepted") actions.push(["shipped", "Отправлено"]);
  }
  if (gift && role === "recipient") {
    if (o.status === "paid") actions.push(["accepted", "Принять подарок"], ["declined", "Отказаться", "Отказаться от подарка? Даритель будет уведомлён."]);
    if (o.status === "shipped") actions.push(["received", "Получено"]);
  }
  const canCancel =
    !closed && ((role === "buyer" && o.status === "new") || (role === "owner" && (gift ? ["new", "paid"].includes(o.status) : true)));

  // Чат: у партнёра два канала (даритель и получатель), у остальных один.
  const ownerTwo = gift && role === "owner";
  const activeChan = ownerTwo ? chan : role === "recipient" ? "recipient" : "main";
  const msgs = (d.messages as any[]).filter((m) => !gift || !ownerTwo || (m.channel ?? "main") === activeChan);
  const chatOpen = activeChan === "main" || ["accepted", "shipped", "received"].includes(o.status);

  const stepIdx = GIFT_STEPS.indexOf(o.status);

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="text-muted text-sm self-start">← Назад</button>
      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-offwhite font-semibold min-w-0 break-words">{gift ? "🎁 " : o.kind === "book" ? "📅 " : "🛒 "}{o.product_name}</p>
          <span className={`text-xs border rounded-full px-2.5 py-0.5 flex-none ${st.tone}`}>{st.label}</span>
        </div>

        {gift && (
          <div className="flex gap-1 my-1">
            {GIFT_STEPS.map((k, i) => (
              <div key={k} title={GIFT_STATUS[k].label} className={`flex-1 h-1.5 rounded-full ${stepIdx >= i && !["declined", "cancelled"].includes(o.status) ? "bg-success" : "bg-muted/40"}`} />
            ))}
          </div>
        )}

        {role === "recipient" ? (
          <>
            <p className="text-offwhite text-sm">От: {o.buyer_name}</p>
            <p className="text-muted text-xs">Магазин: {o.business_name}</p>
            {o.size && <p className="text-offwhite text-sm">Размер: {o.size}</p>}
            {o.gift_message && <p className="text-offwhite text-sm bg-bgPrimary rounded-lg p-2.5 mt-1">«{o.gift_message}»</p>}
            {o.status === "paid" && <p className="text-muted text-xs mt-1">Вы ничего не оплачиваете. Если примете подарок, магазин напишет вам в чате, чтобы уточнить, куда отправить. Адрес увидит только магазин.</p>}
          </>
        ) : (
          <>
            <p className="text-muted text-xs">{role === "owner" ? `Покупатель: ${o.buyer_name}` : `Партнёр: ${o.business_name}`}</p>
            {gift && <p className="text-offwhite text-sm">Подарок для: {o.recipient_name || "получателя"} · {o.gift_anon ? "анонимно" : "с именем дарителя"}</p>}
            {gift && o.gift_message && <p className="text-muted text-sm">Открытка: «{o.gift_message}»</p>}
            {o.sku && <p className="text-muted text-xs">Артикул {o.sku}</p>}
            {o.size && <p className="text-offwhite text-sm">Размер: {o.size}</p>}
            {o.kind !== "book" && <p className="text-offwhite text-sm">{o.qty} шт. · {money(o.unit_price, cur)}{o.discount_percent ? ` · скидка ${o.discount_percent}% (${o.promo_code})` : ""}</p>}
            {o.kind !== "book" && <p className="text-gold text-sm font-semibold">Итого: {money(o.total, cur)}</p>}
            {o.when_text && <p className="text-offwhite text-sm">Когда: {o.when_text}</p>}
            {o.note && <p className="text-muted text-sm">«{o.note}»</p>}
            {role === "owner" && o.phone && <p className="text-offwhite text-sm">📞 {o.phone}</p>}
            {gift && role === "buyer" && o.status === "new" && <p className="text-gold text-xs mt-1">Оплатите подарок магазину напрямую: договоритесь о способе оплаты в чате. Магазин отметит оплату, и подарок уйдёт получателю.</p>}
            {gift && role === "buyer" && o.status === "paid" && <p className="text-muted text-xs mt-1">Ждём, пока получатель примет подарок.</p>}
            {gift && role === "owner" && o.status === "paid" && <p className="text-muted text-xs mt-1">Ждём ответа получателя. Адрес спрашивайте только после того, как он примет подарок.</p>}
            {gift && role === "owner" && o.status === "declined" && <p className="text-danger text-xs mt-1">Участница отказалась. Верните оплату дарителю и отмените заказ.</p>}
          </>
        )}
      </div>

      {(actions.length > 0 || canCancel || (gift && role === "owner" && o.status === "declined")) && (
        <div className="flex flex-wrap gap-2 items-center">
          {actions.map(([k, l, ask]) => (
            <button key={k} disabled={busy} onClick={() => setStatus(k, ask)} className={`font-semibold rounded-full px-4 py-2 text-sm disabled:opacity-50 ${k === "declined" ? "border border-muted text-offwhite" : "bg-gold text-bgPrimary"}`}>{l}</button>
          ))}
          {(canCancel || (gift && role === "owner" && o.status === "declined")) && (
            <button disabled={busy} onClick={() => setStatus("cancelled", "Отменить?")} className="text-danger text-xs underline">Отменить</button>
          )}
        </div>
      )}

      <div className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col gap-2">
        {ownerTwo ? (
          <div className="flex gap-2">
            {([["main", "Даритель"], ["recipient", "Участница"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setChan(k)} className={`px-3 py-1 rounded-full text-xs border ${chan === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
            ))}
          </div>
        ) : (
          <p className="text-offwhite text-sm font-semibold">{role === "recipient" ? "Чат с магазином" : gift ? "Чат с магазином" : "Чат по заказу"}</p>
        )}
        {!chatOpen ? (
          <p className="text-muted text-xs">{role === "owner" ? "Чат с получателем откроется, когда он примет подарок." : "Чат откроется, когда вы примете подарок."}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {msgs.length === 0 && <p className="text-muted text-xs">Сообщений пока нет.{role === "owner" && activeChan === "recipient" ? " Спросите, куда отправить подарок." : ""}</p>}
              {msgs.map((m: any) => {
                const mine = m.sender_id === d.me;
                return (
                  <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${mine ? "self-end bg-gold text-bgPrimary" : "self-start bg-bgPrimary text-offwhite"}`}>
                    {m.body}
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение" maxLength={1000} className="flex-1 min-w-0 bg-bgPrimary border border-muted rounded-full px-4 py-2 text-sm text-offwhite" />
              <button onClick={send} disabled={busy || !text.trim()} className="bg-gold text-bgPrimary font-semibold rounded-full px-4 text-sm disabled:opacity-50">→</button>
            </div>
          </>
        )}
        {err && <p className="text-danger text-xs">{err}</p>}
      </div>
    </div>
  );
}
