"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const KEYS = ["strip_enabled", "strip_text", "howitworks_enabled", "howitworks_text"];

// CRM → «Главная»: красная полоса и кнопка «Как это работает».
export default function AdminHomeSettingsPanel() {
  const [v, setV] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("platform_settings").select("key, value").in("key", KEYS);
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => (m[r.key] = r.value ?? ""));
      setV(m);
      setLoading(false);
    })();
  }, []);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    await supabase.from("platform_settings").upsert(
      KEYS.map((k) => ({ key: k, value: v[k] ?? "" }))
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  const Toggle = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-2 text-offwhite text-sm mb-2">
      <input type="checkbox" checked={v[k] === "true"} onChange={(e) => set(k, e.target.checked ? "true" : "false")} />
      {label}
    </label>
  );

  return (
    <div className="max-w-lg flex flex-col gap-5">
      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">Яркая полоса «До отсева недели»</p>
        <Toggle k="strip_enabled" label="Показывать на главной (только в последние 3 часа перед отсевом)" />
        <input
          value={v.strip_text ?? ""}
          onChange={(e) => set("strip_text", e.target.value)}
          placeholder="🔥 До отсева недели: {time}"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-muted text-xs mt-1">Вместо {"{time}"} подставится обратный отсчёт. Пусто — стандартный текст.</p>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">Кнопка под баннером «Как это работает»</p>
        <Toggle k="howitworks_enabled" label="Показывать на главной" />
        <input
          value={v.howitworks_text ?? ""}
          onChange={(e) => set("howitworks_text", e.target.value)}
          placeholder="Как это работает"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button onClick={save} className="bg-gold text-bgPrimary font-semibold py-2.5 rounded-full text-sm">
        {saved ? "Сохранено ✓" : "Сохранить"}
      </button>
    </div>
  );
}
