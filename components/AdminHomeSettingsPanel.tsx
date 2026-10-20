"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";
import { loadScoped, scopedKey } from "@/lib/scopedSettings";
import { apiPost } from "@/lib/authClient";

const KEYS = ["publishing_enabled", "strip_enabled", "strip_text", "howitworks_enabled", "howitworks_text", "fanzone_enabled", "fanzone_min_amount", "media_season_id", "survey_question"];

type SeasonOpt = { id: string; title: string };

// CRM → «Главная»: красная полоса и кнопка «Как это работает».
export default function AdminHomeSettingsPanel() {
  const [v, setV] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [seasons, setSeasons] = useState<SeasonOpt[]>([]);
  const [answers, setAnswers] = useState<{ question: string; total: number; items: { name: string; answer: string; at: string }[] } | null>(null);

  async function loadAnswers() {
    const r = await apiPost("/api/admin/survey", { countryId: getCrmCountry() || undefined });
    setAnswers(r?.ok ? { question: r.question, total: r.total, items: r.items } : { question: "", total: 0, items: [] });
  }

  useEffect(() => {
    (async () => {
      setV(await loadScoped(KEYS, getCrmCountry() || null));
      let sq = supabase.from("seasons").select("id, title").order("created_at", { ascending: false });
      if (getCrmCountry()) sq = sq.eq("country_id", getCrmCountry());
      const { data: sn } = await sq;
      setSeasons((sn as SeasonOpt[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    await supabase.from("platform_settings").upsert(
      KEYS.map((k) => ({ key: scopedKey(k, getCrmCountry() || null), value: v[k] ?? "" }))
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

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">📤 Приём публикаций (фото и видео)</p>
        <label className="flex items-center gap-2 text-offwhite text-sm mb-1">
          <input
            type="checkbox"
            checked={v.publishing_enabled !== "false"}
            onChange={(e) => set("publishing_enabled", e.target.checked ? "true" : "false")}
          />
          Публикации включены
        </label>
        <p className="text-muted text-xs">
          Выключено — человек как обычно добавляет фото или видео и жмёт «Опубликовать», но ничего не выходит в ленту: материал сохраняется в черновики, и ему пишется «Публикации откроются после начала сезона». Включите, когда сезон начнётся.
        </p>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">🔥 Живая Фан-Зона (в разделе «Подарки»)</p>
        <label className="flex items-center gap-2 text-offwhite text-sm mb-2">
          <input
            type="checkbox"
            checked={v.fanzone_enabled !== "false"}
            onChange={(e) => set("fanzone_enabled", e.target.checked ? "true" : "false")}
          />
          Показывать живую строку с дорогими подарками и покупками
        </label>
        <input
          type="number"
          value={v.fanzone_min_amount ?? ""}
          onChange={(e) => set("fanzone_min_amount", e.target.value)}
          placeholder="50"
          className="w-40 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-muted text-xs mt-1">Минимальная сумма покупки ({crmCur}), чтобы она попала в ленту. Пусто — 50 {crmCur}. Меняется сразу для новых покупок.</p>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">🎬 Какое шоу показывает раздел «Медиа»</p>
        <select
          value={v.media_season_id ?? ""}
          onChange={(e) => set("media_season_id", e.target.value)}
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite"
        >
          <option value="">Автоматически — самый свежий сезон каждой страны</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <p className="text-muted text-xs mt-1">
          В «Медиа» видны только ролики участниц этого шоу. Старые фото и видео остаются на страницах участниц. Выбранный сезон действует только для своей страны, остальные страны используют свой самый свежий сезон. Когда начнётся новое шоу, выберите его здесь (или оставьте «Автоматически»).
        </p>
      </div>

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">📋 Опрос на главной</p>
        <p className="text-muted text-xs">
          Вопрос опроса теперь задаётся для каждого этапа: «Конкурс» → «Этапы сезона» → поле «Вопрос опроса этапа». Люди выбирают участницу, один бесплатный голос на этап. Здесь — итоги текущего этапа: за кого голосовали.
        </p>
        <button onClick={loadAnswers} className="mt-3 border border-gold text-gold rounded-lg px-4 py-2 text-sm">
          {answers ? "Обновить ответы" : "Показать ответы"}
        </button>
        {answers && (
          <div className="mt-3 flex flex-col gap-2">
            {!answers.question ? (
              <p className="text-muted text-xs">Вопрос сейчас не задан (или не сохранён).</p>
            ) : (
              <>
                <p className="text-offwhite text-xs">
                  Вопрос: «{answers.question}». Ответов: <b>{answers.total}</b>
                </p>
                {answers.items.length === 0 && <p className="text-muted text-xs">Пока никто не ответил.</p>}
                {answers.items.map((a, i) => (
                  <div key={i} className="bg-bgPrimary border border-muted/50 rounded-lg px-3 py-2">
                    <p className="text-offwhite text-sm">{a.answer}</p>
                    <p className="text-muted text-[11px] mt-0.5">
                      {a.name} · {new Date(a.at).toLocaleString("ru-RU")}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <button onClick={save} className="bg-gold text-bgPrimary font-semibold py-2.5 rounded-full text-sm">
        {saved ? "Сохранено ✓" : "Сохранить"}
      </button>
    </div>
  );
}
