"use client";

import { useEffect, useMemo, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { Breakdowns, MetricTiles, Tile, downloadCsv, fmtDwell } from "@/components/AdBreakdowns";

const PERIODS: [string, string][] = [
  ["today", "Сегодня"],
  ["yesterday", "Вчера"],
  ["7d", "7 дней"],
  ["30d", "30 дней"],
  ["all", "Всё время"],
];

// CRM → «Статистика рекламы»: показы, просмотры, клики, пролистывание, время на экране.
export default function AdminAdStatsPanel() {
  const [period, setPeriod] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<{ userId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, any[]> | null>(null);
  const [label, setLabel] = useState("");
  const [owner, setOwner] = useState("");
  const [saved, setSaved] = useState(false);

  const range = useMemo(() => (from ? { from, to: to || undefined } : { period }), [from, to, period]);

  async function load() {
    setLoading(true);
    const r = await apiPost("/api/admin/ad-stats", { ...range, countryId: getCrmCountry() });
    setItems(r?.items ?? []);
    setSponsors(r?.sponsors ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    setOpen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const shown = items.filter((i) => type === "all" || i.type === type);
  const sum = (k: string) => shown.reduce((s, i) => s + (i[k] ?? 0), 0);
  const impressions = sum("impressions");
  const views = sum("views");
  const clicks = sum("clicks");

  async function openItem(i: any) {
    const key = i.type + ":" + i.id;
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    setDetail(null);
    setLabel("");
    setOwner(i.sponsorUserId ?? "");
    const r = await apiPost("/api/admin/ad-stats", { ...range, countryId: getCrmCountry(), action: "detail", type: i.type, id: i.id });
    setDetail(r?.breakdowns ?? {});
  }

  async function saveOwner(i: any) {
    await apiPost("/api/admin/ad-stats", { action: "set_owner", type: i.type, id: i.id, sponsorUserId: owner || null, label: label.trim() || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    load();
  }

  function exportCsv() {
    downloadCsv(
      "реклама.csv",
      ["Реклама", "Тип", "Партнёр", "Показано", "Увидели", "Уникальных людей", "Кликов", "Уникальных кликнувших", "CTR %", "Видимость %", "Лист.", "Мимо", "Закрыли", "Время на экране, мс"],
      shown.map((i) => [i.name, i.typeLabel, i.sponsorName ?? "", i.impressions, i.views, i.uniqViewers, i.clicks, i.uniqClickers, i.ctr, i.viewability, i.swipes, i.skips, i.closes, i.avgDwellMs])
    );
  }

  const types = Array.from(new Set<string>(items.map((i) => i.type)));
  const typeName: Record<string, string> = { all: "Всё", banner: "Баннеры", logo: "Логотипы", magazine: "Журнал", popup: "Окно входа", ticker: "Строка", directory: "Каталог" };

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap gap-2 mb-3">
        {PERIODS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              setFrom("");
              setTo("");
              setPeriod(k);
            }}
            className={`px-3 py-1.5 rounded-full text-xs border ${!from && period === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-muted">
        <span>или период:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-bgPrimary border border-muted rounded-lg px-2 py-1 text-offwhite" />
        <span>—</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-bgPrimary border border-muted rounded-lg px-2 py-1 text-offwhite" />
        <button onClick={exportCsv} className="ml-auto border border-gold text-gold rounded-full px-3 py-1.5">
          Выгрузить в Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {["all", ...types].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-2.5 py-1 rounded-full text-[11px] border ${type === t ? "border-gold text-gold" : "border-muted text-muted"}`}
          >
            {typeName[t] ?? t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Tile label="Показано" value={impressions} />
        <Tile label="Увидели" value={views} sub={impressions ? `${Math.round((views / impressions) * 100)}% видимость` : undefined} />
        <Tile label="Кликов" value={clicks} />
        <Tile label="CTR" value={(views > 0 ? ((clicks / views) * 100).toFixed(1) : "0") + "%"} />
      </div>

      {loading ? (
        <p className="text-muted text-sm">Загрузка...</p>
      ) : shown.length === 0 ? (
        <p className="text-muted text-sm">Пока нет данных за этот период. Данные копятся с момента обновления сайта.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((i) => {
            const key = i.type + ":" + i.id;
            const isOpen = open === key;
            return (
              <div key={key} className="bg-bgSurface border border-muted rounded-xl">
                <button onClick={() => openItem(i)} className="w-full p-3 flex items-center gap-3 text-left">
                  {i.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="w-16 h-10 object-cover rounded flex-shrink-0 bg-black" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-offwhite text-sm truncate">{i.name}</p>
                    <p className="text-muted text-[10px] truncate">
                      {i.typeLabel}
                      {i.sponsorName ? ` · партнёр: ${i.sponsorName}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <p className="text-offwhite">{i.views} увид. / {i.impressions} показ.</p>
                    <p className="text-gold">
                      {i.clicks} кл. · CTR {i.ctr}% · {fmtDwell(i.avgDwellMs)}
                    </p>
                  </div>
                </button>
                {isOpen && (
                  <div className="p-3 pt-0 flex flex-col gap-3">
                    <MetricTiles m={i} />
                    <div className="bg-bgPrimary border border-muted rounded-xl p-3">
                      <p className="text-offwhite text-sm font-semibold mb-2">Чья это реклама</p>
                      <div className="flex flex-wrap gap-2">
                        <select value={owner} onChange={(e) => setOwner(e.target.value)} className="bg-bgSurface border border-muted rounded-lg px-2 py-1.5 text-xs text-offwhite flex-1 min-w-[140px]">
                          <option value="">— без партнёра —</option>
                          {sponsors.map((s) => (
                            <option key={s.userId} value={s.userId}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="Название (по желанию)"
                          maxLength={80}
                          className="bg-bgSurface border border-muted rounded-lg px-2 py-1.5 text-xs text-offwhite flex-1 min-w-[140px]"
                        />
                        <button onClick={() => saveOwner(i)} className="bg-gold text-bgPrimary font-semibold rounded-full px-4 text-xs">
                          {saved ? "✓" : "Сохранить"}
                        </button>
                      </div>
                      <p className="text-muted text-[10px] mt-1.5">Партнёр увидит цифры по этой рекламе у себя в кабинете.</p>
                    </div>
                    <Breakdowns b={detail} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
