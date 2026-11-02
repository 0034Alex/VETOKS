"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { money } from "@/lib/businessShared";

const fmtMin = (m: number | null) => (m === null ? "—" : m < 60 ? `${m} мин` : m < 1440 ? `${Math.round(m / 6) / 10} ч` : `${Math.round(m / 144) / 10} дн`);

// Учёт магазина за 30 дней: сколько заказов, как отвечают владелец и менеджер.
export default function ShopAccounting({ cur }: { cur: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    apiPost("/api/business/settings", { action: "stats" }).then((r: any) => setD(r?.ok ? r : { unavailable: true }));
  }, []);
  if (!d) return <p className="text-muted text-sm">Загрузка...</p>;
  if (d.unavailable) return <p className="text-muted text-sm">Раздел ещё настраивается. Попробуйте позже.</p>;
  const t = d.totals;
  const cell = (label: string, v: string | number, tone = "text-offwhite") => (
    <div className="bg-bgSurface border border-muted rounded-xl p-3">
      <p className={`text-lg font-bold ${tone}`}>{v}</p>
      <p className="text-muted text-xs">{label}</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-xs">За последние 30 дней.</p>
      <div className="grid grid-cols-2 gap-2">
        {cell("Заказов получено", t.created)}
        {cell("Продано на сумму", money(t.revenue, cur), "text-gold")}
        {cell("Ждут ответа", t.new, t.new ? "text-gold" : "text-offwhite")}
        {cell("Ждут оплаты", t.confirmed)}
        {cell("В работе (оплачены)", t.paid + t.shipped)}
        {cell("Выполнено", t.done, "text-success")}
        {cell("Отменено", t.cancelled)}
        {cell("Возвраты", t.returned)}
      </div>
      {t.disputed > 0 && <p className="text-muted text-xs">Спорных оплат («деньги не пришли»): {t.disputed}</p>}

      {d.waiting?.length > 0 && (
        <div className="rounded-xl border border-gold/50 bg-gold/10 p-3 flex flex-col gap-1.5">
          <p className="text-offwhite text-sm font-semibold">Без ответа больше 2 часов</p>
          {d.waiting.map((w: any) => (
            <a key={w.id} href={`/business?tab=orders&o=${w.id}`} className="text-offwhite text-xs flex justify-between gap-2">
              <span className="truncate">{w.name}</span>
              <span className="text-gold flex-none">{fmtMin(w.ageMin)}</span>
            </a>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-offwhite text-sm font-semibold">Кто как работает</p>
        {d.actors?.length === 0 && <p className="text-muted text-xs">Пока нет действий по заказам.</p>}
        {d.actors?.map((a: any) => (
          <div key={a.role + a.name} className="bg-bgSurface border border-muted rounded-xl p-3">
            <div className="flex justify-between gap-2">
              <p className="text-offwhite text-sm font-semibold break-words">{a.role === "manager" ? "Менеджер " : ""}{a.name}</p>
              <p className="text-muted text-xs flex-none">ответ в среднем: <span className="text-offwhite">{fmtMin(a.avgMin)}</span></p>
            </div>
            <p className="text-muted text-xs mt-1">Действий: {a.handled} · одобрено {a.approve} · отказов {a.decline} · оплат подтверждено {a.paid} · «не пришли» {a.nopaid} · отправлено {a.ship}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
