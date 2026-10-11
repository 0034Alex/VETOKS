"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// CRM → «Рейтинг и титулы»: ночной пересчёт, список титулов, настройки штрафа.

type Title = {
  key: string;
  label: string;
  unit: string;
  metric: string;
  enabled: boolean;
  sort_order: number;
};

const METRICS: { key: string; label: string }[] = [
  { key: "total_votes", label: "Больше всего голосов (1-е место)" },
  { key: "second_votes", label: "Второе место по голосам" },
  { key: "day_votes", label: "Больше всего бесплатных голосов за сутки" },
  { key: "gifts", label: "Больше всего подарков" },
  { key: "followers", label: "Больше всего подписчиков" },
  { key: "tasks", label: "Больше всего выполненных заданий" },
  { key: "messages", label: "Больше всего сообщений" },
  { key: "boosts", label: "Больше всего бустов" },
  { key: "rookie_votes", label: "Новичок (за 7 дней) с наибольшим числом голосов" },
];

const metricLabel = (k: string) => METRICS.find((m) => m.key === k)?.label ?? k;

export default function AdminRatingPanel() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState("");
  const [lastRun, setLastRun] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [pct, setPct] = useState("10");
  const [minMarks, setMinMarks] = useState("2");
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newMetric, setNewMetric] = useState("gifts");

  function flash(k: string) {
    setSavedKey(k);
    setTimeout(() => setSavedKey(""), 1500);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("title_settings")
      .select("key, label, unit, metric, enabled, sort_order")
      .order("sort_order");
    setTitles((data as Title[]) ?? []);

    const { data: set } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["last_daily_run", "black_mark_penalty_percent", "black_mark_min_marks"]);
    const m: Record<string, string> = {};
    (set ?? []).forEach((r: { key: string; value: string }) => (m[r.key] = r.value));
    try {
      setLastRun(m.last_daily_run ? JSON.parse(m.last_daily_run) : null);
    } catch {
      setLastRun(null);
    }
    setPct(m.black_mark_penalty_percent ?? "10");
    setMinMarks(m.black_mark_min_marks ?? "2");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function recalcNow() {
    if (!confirm("Пересчитать рейтинг, титулы и Топ-25 прямо сейчас?")) return;
    setRunning(true);
    setRunMsg("");
    const { data: sess } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/admin/recalc", {
        method: "POST",
        headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
      });
      const json = await res.json();
      if (json.ok) {
        setRunMsg(
          `Готово: участниц ${json.summary.participants}, титулов ${json.summary.titles}, ` +
            `в Топ-25 ${json.summary.top25}, штрафов ${json.summary.penalties}.`
        );
        await load();
      } else setRunMsg("Не получилось пересчитать. Попробуйте ещё раз.");
    } catch {
      setRunMsg("Не получилось пересчитать. Попробуйте ещё раз.");
    }
    setRunning(false);
  }

  async function saveTitle(t: Title) {
    await supabase
      .from("title_settings")
      .update({
        label: t.label,
        unit: t.unit,
        enabled: t.enabled,
        sort_order: Number(t.sort_order) || 0,
      })
      .eq("key", t.key);
    flash(t.key);
  }

  async function deleteTitle(t: Title) {
    if (!confirm(`Удалить титул «${t.label}»?`)) return;
    await supabase.from("title_settings").delete().eq("key", t.key);
    await load();
  }

  async function addTitle() {
    if (!newLabel.trim()) return;
    const maxOrder = titles.reduce((m, t) => Math.max(m, t.sort_order), 0);
    await supabase.from("title_settings").insert({
      key: `custom_${Date.now()}`,
      label: newLabel.trim(),
      unit: newUnit.trim(),
      metric: newMetric,
      enabled: true,
      sort_order: maxOrder + 10,
    });
    setNewLabel("");
    setNewUnit("");
    await load();
  }

  async function saveSetting(key: string, value: string) {
    await supabase.from("platform_settings").upsert({ key, value });
    flash(key);
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  const inputCls = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm";
  const btnCls = "bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm";

  return (
    <div className="max-w-xl">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <p className="text-offwhite text-sm font-semibold mb-1">Ночной пересчёт</p>
        <p className="text-muted text-xs mb-3">
          Каждую ночь в 00:01 (Киев) сервер сам считает титулы по регионам и
          стране, Топ-25 за прошедшие сутки, стрелки изменения мест и в
          понедельник — штраф за чёрные метки. Кнопка ниже делает то же самое
          вручную.
        </p>
        {lastRun ? (
          <p className="text-muted text-xs mb-3">
            Последний пересчёт: {new Date(lastRun.at).toLocaleString("ru-RU")} · участниц{" "}
            {lastRun.participants}, титулов {lastRun.titles}, Топ-25: {lastRun.top25}
          </p>
        ) : (
          <p className="text-muted text-xs mb-3">Пересчёт ещё ни разу не запускался.</p>
        )}
        <button onClick={recalcNow} disabled={running} className={`${btnCls} disabled:opacity-50`}>
          {running ? "Считаем..." : "Посчитать сейчас"}
        </button>
        {runMsg && <p className="text-gold text-xs mt-2">{runMsg}</p>}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Титулы</h3>
      <div className="flex flex-col gap-3 mb-6">
        {titles.map((t, i) => (
          <div key={t.key} className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-muted text-[11px] mb-2">{metricLabel(t.metric)}</p>
            <div className="flex flex-col gap-2">
              <input
                value={t.label}
                onChange={(e) => {
                  const n = [...titles];
                  n[i] = { ...t, label: e.target.value };
                  setTitles(n);
                }}
                className={inputCls}
                placeholder="Название"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={t.unit}
                  onChange={(e) => {
                    const n = [...titles];
                    n[i] = { ...t, unit: e.target.value };
                    setTitles(n);
                  }}
                  className={`${inputCls} w-36`}
                  placeholder="единица (голосов)"
                />
                <span className="text-muted text-xs">порядок</span>
                <input
                  value={t.sort_order}
                  onChange={(e) => {
                    const n = [...titles];
                    n[i] = { ...t, sort_order: Number(e.target.value) || 0 };
                    setTitles(n);
                  }}
                  className={`${inputCls} w-16`}
                />
                <label className="text-muted text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) => {
                      const n = [...titles];
                      n[i] = { ...t, enabled: e.target.checked };
                      setTitles(n);
                    }}
                  />
                  включён
                </label>
                <div className="ml-auto flex gap-2">
                  {t.key.startsWith("custom_") && (
                    <button onClick={() => deleteTitle(t)} className="text-danger text-xs underline">
                      Удалить
                    </button>
                  )}
                  <button onClick={() => saveTitle(t)} className={btnCls}>
                    {savedKey === t.key ? "✓" : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Добавить новый титул</h3>
      <div className="bg-bgSurface border border-muted rounded-xl p-4 mb-6 flex flex-col gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className={inputCls}
          placeholder="Название, например: 🌹 Мисс обаяния"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            className={`${inputCls} w-36`}
            placeholder="единица"
          />
          <select
            value={newMetric}
            onChange={(e) => setNewMetric(e.target.value)}
            className={`${inputCls} flex-1 min-w-0`}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <button onClick={addTitle} className={btnCls}>
            Добавить
          </button>
        </div>
      </div>

      <h3 className="text-offwhite font-semibold mb-2">Чёрные метки: штраф</h3>
      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-offwhite text-sm">Штраф, % от голосов:</span>
          <input value={pct} onChange={(e) => setPct(e.target.value)} className={`${inputCls} w-16`} />
          <button
            onClick={() =>
              saveSetting(
                "black_mark_penalty_percent",
                String(Math.min(100, Math.max(0, Number(pct) || 0)))
              )
            }
            className={`${btnCls} ml-auto`}
          >
            {savedKey === "black_mark_penalty_percent" ? "✓" : "Сохранить"}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-offwhite text-sm">Минимум меток для штрафа:</span>
          <input
            value={minMarks}
            onChange={(e) => setMinMarks(e.target.value)}
            className={`${inputCls} w-16`}
          />
          <button
            onClick={() =>
              saveSetting("black_mark_min_marks", String(Math.max(1, Math.floor(Number(minMarks) || 2))))
            }
            className={`${btnCls} ml-auto`}
          >
            {savedKey === "black_mark_min_marks" ? "✓" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
