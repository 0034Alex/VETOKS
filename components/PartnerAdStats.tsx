"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { Breakdowns, MetricTiles, Tile, fmtDwell } from "@/components/AdBreakdowns";

const PERIODS: [string, string][] = [
  ["today", "Сегодня"],
  ["7d", "7 дней"],
  ["30d", "30 дней"],
  ["all", "Всё время"],
];

// Кабинет партнёра → «Статистика моей рекламы».
export default function PartnerAdStats() {
  const [period, setPeriod] = useState("7d");
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, any[]> | null>(null);

  useEffect(() => {
    (async () => {
      setItems(null);
      const r = await apiPost("/api/partner/ad-stats", { period });
      setItems(r?.items ?? []);
    })();
  }, [period]);

  async function openItem(i: any) {
    const key = i.type + ":" + i.id;
    if (open === key) return setOpen(null);
    setOpen(key);
    setDetail(null);
    const r = await apiPost("/api/partner/ad-stats", { period, action: "detail", type: i.type, id: i.id });
    setDetail(r?.breakdowns ?? {});
  }

  if (items && items.length === 0) {
    return <p className="text-muted text-sm mb-8">Статистика появится, когда ваша реклама начнёт показываться.</p>;
  }
  const sum = (k: string) => (items ?? []).reduce((s, i) => s + (i[k] ?? 0), 0);
  const views = sum("views");
  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-2 mb-3">
        {PERIODS.map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-full text-xs border ${period === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}>
            {l}
          </button>
        ))}
      </div>
      {!items ? (
        <p className="text-muted text-sm">Загрузка...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Tile label="Показано" value={sum("impressions")} />
            <Tile label="Увидели" value={views} />
            <Tile label="Кликов" value={sum("clicks")} />
            <Tile label="CTR" value={(views > 0 ? ((sum("clicks") / views) * 100).toFixed(1) : "0") + "%"} />
          </div>
          <div className="flex flex-col gap-2">
            {items.map((i) => {
              const key = i.type + ":" + i.id;
              return (
                <div key={key} className="bg-bgSurface border border-muted rounded-xl">
                  <button onClick={() => openItem(i)} className="w-full p-3 flex items-center gap-3 text-left">
                    {i.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt="" className="w-14 h-9 object-cover rounded flex-shrink-0 bg-black" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-offwhite text-sm truncate">{i.name}</p>
                      <p className="text-muted text-[10px]">{i.typeLabel}</p>
                    </div>
                    <div className="text-right text-xs flex-shrink-0">
                      <p className="text-offwhite">{i.views} увид.</p>
                      <p className="text-gold">{i.clicks} кл. · {fmtDwell(i.avgDwellMs)}</p>
                    </div>
                  </button>
                  {open === key && (
                    <div className="p-3 pt-0 flex flex-col gap-3">
                      <MetricTiles m={i} />
                      <Breakdowns b={detail} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
