"use client";

// Общие куски отчётов по рекламе: плитки цифр и разбивки (CRM и кабинет партнёра).
export const fmtDwell = (ms: number) => (ms >= 1000 ? (ms / 1000).toFixed(1) + " с" : ms > 0 ? ms + " мс" : "—");

export function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-bgSurface border border-muted rounded-xl p-3 min-w-0">
      <p className="text-gold text-lg font-semibold leading-tight">{value}</p>
      <p className="text-offwhite text-[11px]">{label}</p>
      {sub && <p className="text-muted text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

export function MetricTiles({ m }: { m: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <Tile label="Показано" value={m.impressions} sub="отрисовано на странице" />
      <Tile label="Реально увидели" value={m.views} sub={`${m.viewability}% от показанного`} />
      <Tile label="Уникальных людей" value={m.uniqViewers} sub="увидели хотя бы раз" />
      <Tile label="Кликов" value={m.clicks} sub={`${m.uniqClickers} уникальных`} />
      <Tile label="CTR" value={m.ctr + "%"} sub="клики / увиденные" />
      <Tile label="Время на экране" value={fmtDwell(m.avgDwellMs)} sub="в среднем на показ" />
      <Tile label="Пролистали вручную" value={m.swipes} />
      <Tile label="Промотали мимо" value={m.skips} sub="показано, но не увидели" />
      {m.closes > 0 && <Tile label="Закрыли" value={m.closes} />}
    </div>
  );
}

const TITLES: Record<string, string> = {
  day: "По дням",
  hour: "По часам (Киев)",
  region: "По регионам",
  platform: "Где открыли",
  placement: "Где показано",
  audience: "Кто смотрел",
  newness: "Новые / вернувшиеся",
  source: "Откуда пришли",
};
const VALUE_LABEL: Record<string, string> = {
  registered: "Зарегистрированные",
  guest: "Гости",
  new: "Новые (первые сутки)",
  returning: "Вернувшиеся",
  "-": "не определено",
  "tg-ios": "Telegram · iPhone",
  "tg-android": "Telegram · Android",
  "tg-tdesktop": "Telegram · компьютер",
  "tg-macos": "Telegram · Mac",
  "tg-web": "Telegram · веб",
  "tg-weba": "Telegram · веб",
  "tg-unknown": "Telegram",
  ios: "iPhone · Safari",
  android: "Android · браузер",
  desktop: "Компьютер",
  "ios-pwa": "iPhone · приложение",
  "android-pwa": "Android · приложение",
  "desktop-pwa": "Компьютер · приложение",
  main: "Главная",
  showcase: "Витрина партнёров",
  directory: "Каталог партнёров",
  magazine: "Журнал",
  entry: "При входе",
  ticker: "Бегущая строка",
};
const label = (k: string) => VALUE_LABEL[k] ?? k;

export function Breakdown({ id, rows }: { id: string; rows: any[] }) {
  if (!rows || rows.length === 0) return null;
  const maxV = Math.max(1, ...rows.map((r) => Math.max(r.views, r.impressions)));
  return (
    <div className="bg-bgSurface border border-muted rounded-xl p-3">
      <p className="text-offwhite text-sm font-semibold mb-2">{TITLES[id] ?? id}</p>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.k}>
            <div className="flex justify-between text-[11px] gap-2">
              <span className="text-offwhite truncate">{label(r.k)}</span>
              <span className="text-muted flex-shrink-0">
                {r.impressions} показ · {r.views} увид. · <span className="text-gold">{r.clicks} кл.</span>
                {r.swipes > 0 ? ` · ${r.swipes} лист.` : ""}
              </span>
            </div>
            <div className="h-1.5 rounded bg-black/40 overflow-hidden mt-0.5">
              <div className="h-full bg-gold/70" style={{ width: `${Math.round((Math.max(r.views, r.impressions) / maxV) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Breakdowns({ b }: { b: Record<string, any[]> | null }) {
  if (!b) return <p className="text-muted text-sm">Загрузка...</p>;
  return (
    <div className="flex flex-col gap-3">
      {["day", "hour", "region", "platform", "placement", "audience", "newness", "source"].map((d) => (
        <Breakdown key={d} id={d} rows={b[d] ?? []} />
      ))}
    </div>
  );
}

// Выгрузка таблицы в файл, который открывается в Excel.
export function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const text = "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
