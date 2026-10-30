"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { ORDER_STATUS, money } from "@/lib/businessShared";

// Один заказ: детали, смена статуса и чат между покупателем и партнёром.
export default function BusinessOrderThread({ id, cur, onBack, onChanged }: { id: string; cur: string; onBack: () => void; onChanged?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [text, setText] = useState("");
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
  }, [d?.messages?.length]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/orders", { action: "send", id, body: text });
    setBusy(false);
    if (r?.ok) {
      setText("");
      load();
    } else setErr("Не отправилось. Попробуйте ещё раз.");
  }

  async function setStatus(st: string) {
    if (st === "cancelled" && !window.confirm("Отменить заказ?")) return;
    setBusy(true);
    const r = await apiPost("/api/business/orders", { action: "status", id, status: st });
    setBusy(false);
    if (r?.ok) {
      await load();
      onChanged?.();
    } else setErr("Не получилось сменить статус.");
  }

  if (!d) return <p className="text-muted text-sm">Загрузка...</p>;
  const o = d.order;
  const owner = d.role === "owner";
  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.new;
  const closed = o.status === "done" || o.status === "cancelled";
  const next: [string, string][] =
    o.status === "new" ? [["confirmed", "Подтвердить"]] : o.status === "confirmed" ? [["shipped", o.kind === "book" ? "Бронь состоялась" : "Отправлено"], ["done", "Выполнен"]] : o.status === "shipped" ? [["done", "Выполнен"]] : [];

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="text-muted text-sm self-start">← К списку</button>
      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-offwhite font-semibold min-w-0 break-words">{o.kind === "book" ? "📅 " : "🛒 "}{o.product_name}</p>
          <span className={`text-xs border rounded-full px-2.5 py-0.5 flex-none ${st.tone}`}>{st.label}</span>
        </div>
        <p className="text-muted text-xs">{owner ? `Покупатель: ${o.buyer_name}` : `Партнёр: ${o.business_name}`}</p>
        {o.sku && <p className="text-muted text-xs">Артикул {o.sku}</p>}
        {o.size && <p className="text-offwhite text-sm">Размер: {o.size}</p>}
        {o.kind === "buy" && <p className="text-offwhite text-sm">{o.qty} шт. · {money(o.unit_price, cur)}{o.discount_percent ? ` · скидка ${o.discount_percent}% (${o.promo_code})` : ""}</p>}
        {o.kind === "buy" && <p className="text-gold text-sm font-semibold">Итого: {money(o.total, cur)}</p>}
        {o.when_text && <p className="text-offwhite text-sm">Когда: {o.when_text}</p>}
        {o.note && <p className="text-muted text-sm">«{o.note}»</p>}
        {owner && o.phone && <p className="text-offwhite text-sm">📞 {o.phone}</p>}
        <p className="text-muted text-[11px] mt-1">Оплата идёт напрямую партнёру. VETOKS в оплате не участвует.</p>
      </div>

      {owner && next.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {next.map(([k, l]) => (
            <button key={k} disabled={busy} onClick={() => setStatus(k)} className="bg-gold text-bgPrimary font-semibold rounded-full px-4 py-2 text-sm disabled:opacity-50">{l}</button>
          ))}
        </div>
      )}
      {!closed && (owner || o.status === "new") && (
        <button disabled={busy} onClick={() => setStatus("cancelled")} className="self-start text-danger text-xs underline">Отменить заказ</button>
      )}

      <div className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col gap-2">
        <p className="text-offwhite text-sm font-semibold">Чат по заказу</p>
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {d.messages.length === 0 && <p className="text-muted text-xs">Сообщений пока нет. Напишите, чтобы уточнить детали.</p>}
          {d.messages.map((m: any) => {
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
        {err && <p className="text-danger text-xs">{err}</p>}
      </div>
    </div>
  );
}
