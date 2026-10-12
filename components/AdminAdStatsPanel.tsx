"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const PERIODS: [string, string][] = [
  ["today", "Сегодня"],
  ["7d", "7 дней"],
  ["30d", "30 дней"],
  ["all", "Всё время"],
];

// CRM → «Статистика рекламы»: показы, клики и CTR по баннерам и логотипам.
export default function AdminAdStatsPanel() {
  const [period, setPeriod] = useState("7d");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await apiPost("/api/admin/ad-stats", { period });
      setItems(r?.items ?? []);
      setLoading(false);
    })();
  }, [period]);

  const totalViews = items.reduce((s, i) => s + i.views, 0);
  const totalClicks = items.reduce((s, i) => s + i.clicks, 0);

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-2 mb-4">
        {PERIODS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-3 py-1.5 rounded-full text-xs border ${period === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-muted text-xs mb-3">
        Всего показов: {totalViews} · кликов: {totalClicks}
        {totalViews > 0 ? ` · CTR ${((totalClicks / totalViews) * 100).toFixed(1)}%` : ""}
      </p>
      {loading ? (
        <p className="text-muted text-sm">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="text-muted text-sm">Пока нет данных за этот период.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((i) => (
            <div key={i.type + i.id} className="bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3">
              {i.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.image} alt="" className="w-16 h-10 object-cover rounded flex-shrink-0 bg-black" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-offwhite text-sm truncate">{i.name}</p>
                <p className="text-muted text-[10px]">{i.type === "banner" ? "баннер" : "логотип в витрине"}</p>
              </div>
              <div className="text-right text-xs flex-shrink-0">
                <p className="text-offwhite">{i.views} показов</p>
                <p className="text-gold">
                  {i.clicks} кликов · {i.views > 0 ? ((i.clicks / i.views) * 100).toFixed(1) : "0"}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
