"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { statusInfo, money } from "@/lib/businessShared";
import BusinessOrderThread from "@/components/BusinessOrderThread";

// Список заказов и подарков: партнёр ("biz"), покупатель ("my"), получательница ("incoming").
export default function BusinessOrdersTab({ mode, cur, openId }: { mode: "biz" | "my" | "incoming"; cur: string; openId?: string | null }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const [filter, setFilter] = useState("all");

  async function load() {
    const r = await apiPost("/api/business/orders", { action: mode });
    setItems(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (open) return <BusinessOrderThread id={open} cur={cur} onBack={() => { setOpen(null); load(); }} onChanged={load} />;
  if (!items) return <p className="text-muted text-sm">Загрузка...</p>;

  const FINAL = ["done", "cancelled", "received", "declined"];
  const shown = items.filter((o) => filter === "all" || (filter === "gifts" ? o.kind === "gift" : filter === "active" ? !FINAL.includes(o.status) : filter === "done" ? ["done", "received"].includes(o.status) : o.status === filter));
  return (
    <div className="flex flex-col gap-3">
      {mode !== "incoming" && (
        <div className="flex gap-2 flex-wrap">
          {[["all", "Все"], ["active", "В работе"], ["gifts", "Подарки"], ["done", "Завершены"], ["cancelled", "Отменены"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-full text-xs border ${filter === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}>{l}</button>
          ))}
        </div>
      )}
      {shown.length === 0 && (
        <p className="text-muted text-sm">
          {mode === "biz" ? "Заказов пока нет." : mode === "incoming" ? "Подарков для вас пока нет." : "Здесь появятся ваши заказы и подарки. Откройте страницу партнёра в разделе «Партнёры»."}
        </p>
      )}
      {shown.map((o) => {
        const st = statusInfo(o.kind, o.status);
        const who = mode === "biz" ? o.buyer_name : o.business_name;
        return (
          <button key={o.id} onClick={() => setOpen(o.id)} className="text-left bg-bgSurface border border-muted rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-offwhite text-sm font-semibold break-words">{o.kind === "gift" ? "🎁 " : o.kind === "book" ? "📅 " : "🛒 "}{o.product_name}</p>
              <p className="text-muted text-xs">
                {who}
                {o.kind === "gift" && mode === "my" && o.recipient_name ? ` → ${o.recipient_name}` : ""} · {new Date(o.created_at).toLocaleDateString("ru-RU")}
                {o.kind !== "book" && mode !== "incoming" ? ` · ${money(o.total, cur)}` : ""}
              </p>
            </div>
            <span className={`text-xs border rounded-full px-2.5 py-0.5 flex-none ${st.tone}`}>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}
