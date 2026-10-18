"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";

type Stats = Record<string, number>;
const PERIODS: [string, string][] = [
  ["today", "Сегодня"],
  ["7d", "7 дней"],
  ["30d", "30 дней"],
  ["all", "Всё время"],
];

// CRM → «Дашборд»: цифры за период и регион + блок «Требует внимания».
export default function AdminDashboard({ onGo }: { onGo: (tab: string) => void }) {
  const [period, setPeriod] = useState("7d");
  const [regionId, setRegionId] = useState("");
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [att, setAtt] = useState<Record<string, number>>({});
  const [pwa, setPwa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    (getCrmCountry()
      ? supabase.from("regions").select("id, name").eq("country_id", getCrmCountry()).order("name")
      : supabase.from("regions").select("id, name").order("name")
    ).then(({ data }) => setRegions((data as any) ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(false);
      const r = await apiPost("/api/admin/dashboard", { period, regionId: regionId || null, countryId: getCrmCountry() });
      if (!r?.ok) setErr(true);
      else {
        setStats(r.stats ?? {});
        setAtt(r.attention ?? {});
        setPwa(r.pwa ?? 0);
      }
      setLoading(false);
    })();
  }, [period, regionId]);

  const n = (k: string) => Math.round(Number(stats[k] ?? 0));
  const money = (k: string) => `${n(k)} ${crmCur}`;

  const attention: [string, number, string][] = [
    ["Анкеты ждут решения", att.applications ?? 0, "applications"],
    ["Жалобы на ролики", att.reports ?? 0, "reports"],
    ["Задания на проверке", att.tasks ?? 0, "tasks"],
    ["Обращения в поддержку", att.support ?? 0, "support"],
    ["Партнёры: пора связаться", att.partners ?? 0, "partners"],
  ];

  const cards: [string, string][] = [
    ["Новых пользователей", String(n("users_new"))],
    ["Всего пользователей", String(n("users_total"))],
    ["Подтвердили номер", String(n("verified_total"))],
    ["Новых участниц", String(n("participants_new"))],
    ["Всего участниц", String(n("participants_total"))],
    ["Бесплатных голосов", String(n("votes_free"))],
    ["Платных голосов", String(n("votes_paid"))],
    ["Пополнено (реальные)", money("topup")],
    ["Потрачено в приложении", money("spent")],
    ["Начислено участницам", money("to_participants")],
    ["Выплачено за задания", money("tasks_paid")],
    ["Установок PWA (всего)", String(pwa)],
  ];

  return (
    <div className="max-w-3xl">
      <p className="text-muted text-sm mb-2">Требует действия</p>
      <div className="flex flex-col gap-2 mb-6">
        {attention.map(([label, count, tab]) => (
          <div key={tab} className="flex items-center gap-3 bg-bgPrimary border border-muted rounded-2xl px-4 py-3">
            <span className={`min-w-[2.2rem] text-center text-lg font-semibold rounded-full px-2 py-0.5 ${count > 0 ? "bg-pink-500 text-white" : "bg-bgSurface text-muted"}`}>{count}</span>
            <span className={`flex-1 text-sm ${count > 0 ? "text-offwhite" : "text-muted"}`}>{label}</span>
            <button
              onClick={() => onGo(tab)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${count > 0 ? "bg-gold text-bgPrimary" : "border border-muted text-muted"}`}
            >
              {count > 0 ? "Открыть" : "Посмотреть"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {PERIODS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              period === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          className="bg-bgPrimary border border-muted rounded-full px-3 py-1.5 text-xs text-offwhite"
        >
          <option value="">Все регионы</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {err && <p className="text-danger text-sm mb-3">Не удалось загрузить цифры. Проверьте, что SQL этапа 5 запущен.</p>}
      {loading ? (
        <p className="text-muted">Загрузка...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cards.map(([label, value]) => (
              <div key={label} className="bg-bgSurface border border-muted rounded-xl p-4">
                <p className="text-gold text-2xl font-semibold">{value}</p>
                <p className="text-muted text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
          {regionId && (
            <p className="text-muted text-xs mt-3">
              Деньги и установки PWA считаются по всем регионам. Остальные цифры — по выбранному региону.
            </p>
          )}
        </>
      )}
    </div>
  );
}
