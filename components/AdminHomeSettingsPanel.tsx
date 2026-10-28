"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";
import { loadScoped, scopedKey } from "@/lib/scopedSettings";
import { apiPost } from "@/lib/authClient";

const KEYS = ["publishing_enabled", "strip_enabled", "strip_text", "fanzone_enabled", "fanzone_min_amount", "cards_enabled", "media_season_id", "survey_question"];

type SeasonOpt = { id: string; title: string };

// CRM → «Главная»: красная полоса, объявления, приём публикаций и др.
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

      <AnnouncementsBlock />

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
        <p className="text-offwhite font-semibold text-sm mb-2">🃏 Коллекционные карточки</p>
        <label className="flex items-center gap-2 text-offwhite text-sm">
          <input
            type="checkbox"
            checked={v.cards_enabled !== "false"}
            onChange={(e) => set("cards_enabled", e.target.checked ? "true" : "false")}
          />
          Карточки включены (если выключить — раздел в «Подарках», «Мои карточки», блок на странице участницы и упоминания в настройках исчезнут)
        </label>
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


type Ann = { country_id?: string | null; all_regions?: boolean | null; region_ids?: string[] | null; id: string; title: string; body: string | null; starts_at: string; ends_at: string; audience: string[]; show_timer: boolean; is_active: boolean };

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Любое объявление на главной: название, текст, когда показывать и кому.
export function AnnouncementsBlock() {
  const [items, setItems] = useState<Ann[]>([]);
  const [needSql, setNeedSql] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [starts, setStarts] = useState(localInput(new Date()));
  const [ends, setEnds] = useState(localInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [aud, setAud] = useState<string[]>(["teen", "main", "adult"]);
  const [timer, setTimer] = useState(true);
  const [msg, setMsg] = useState("");
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [allRegions, setAllRegions] = useState(true);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const cc = getCrmCountry() || null;

  useEffect(() => {
    (async () => {
      let rq = supabase.from("regions").select("id, name").order("name");
      if (cc) rq = rq.eq("country_id", cc);
      const { data } = await rq;
      setRegions((data as { id: string; name: string }[]) ?? []);
    })();
  }, [cc]);

  async function load() {
    const r = await apiPost("/api/admin/announcements", { action: "list" });
    if (r?.ok) {
      // Видим объявления выбранной в CRM страны и общие.
      setItems(((r.items ?? []) as Ann[]).filter((a) => !a.country_id || !cc || String(a.country_id) === String(cc)));
      setNeedSql(false);
    } else if (r?.error === "need_sql") setNeedSql(true);
  }
  useEffect(() => {
    load();
  }, []);

  function quick(h: number) {
    const st = new Date(starts);
    setEnds(localInput(new Date((isNaN(st.getTime()) ? Date.now() : st.getTime()) + h * 3600 * 1000)));
  }

  async function create() {
    const r = await apiPost("/api/admin/announcements", {
      action: "create",
      title,
      body,
      starts_at: new Date(starts).toISOString(),
      ends_at: new Date(ends).toISOString(),
      audience: aud,
      show_timer: timer,
      country_id: cc,
      all_regions: allRegions,
      region_ids: regionIds,
    });
    if (r?.ok) {
      setTitle("");
      setBody("");
      setMsg("Объявление добавлено.");
      load();
    } else setMsg(r?.error === "bad_dates" ? "Конец должен быть позже начала." : r?.error === "no_title" ? "Напишите название." : "Не получилось. Проверьте, что SQL для объявлений выполнен.");
  }

  const act = async (body: object) => {
    await apiPost("/api/admin/announcements", body);
    load();
  };
  const toggleAud = (k: string) => setAud((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const fmt = (s: string) => new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const now = Date.now();

  return (
    <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
      <p className="text-offwhite font-semibold text-sm mb-2">📢 Объявления на главной</p>
      <p className="text-muted text-xs mb-3">Яркий блок на главной: любое название и текст, на час, день или дольше, для выбранных категорий.</p>
      {needSql && <p className="text-danger text-xs mb-2">Нужно выполнить SQL для объявлений (он у вас в чате).</p>}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название, напр. «🔥 Голосование до воскресенья»" className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Текст (необязательно)" className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-muted text-xs">Показать с<input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className="w-full bg-bgPrimary border border-muted rounded-lg px-2 py-2 text-sm text-offwhite mt-1" /></label>
        <label className="text-muted text-xs">Показать до<input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className="w-full bg-bgPrimary border border-muted rounded-lg px-2 py-2 text-sm text-offwhite mt-1" /></label>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {([[1, "1 час"], [24, "1 день"], [72, "3 дня"], [168, "неделя"]] as const).map(([h, l]) => (
          <button key={h} onClick={() => quick(h)} className="text-xs px-3 py-1 rounded-full border border-muted text-offwhite">{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mb-2">
        {([["teen", "TEEN"], ["main", "MISS"], ["adult", "LADY"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-1 text-offwhite text-sm"><input type="checkbox" checked={aud.includes(k)} onChange={() => toggleAud(k)} /> {l}</label>
        ))}
      </div>
      <p className="text-muted text-xs mb-1">Где показывать (страна — та, что выбрана вверху CRM):</p>
      <label className="flex items-center gap-2 text-offwhite text-sm mb-1"><input type="checkbox" checked={allRegions} onChange={(e) => setAllRegions(e.target.checked)} /> Вся страна</label>
      {!allRegions && (
        <div className="flex flex-wrap gap-2 mb-2 max-h-32 overflow-y-auto">
          {regions.map((rg) => (
            <button key={rg.id} type="button" onClick={() => setRegionIds((p) => (p.includes(rg.id) ? p.filter((x) => x !== rg.id) : [...p, rg.id]))} className={`text-[11px] px-2 py-1 rounded-full border ${regionIds.includes(rg.id) ? "border-gold text-gold bg-gold/10" : "border-muted text-muted"}`}>{rg.name}</button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-offwhite text-sm mb-3"><input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} /> Показывать обратный отсчёт до конца</label>
      <button onClick={create} disabled={!title.trim()} className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40">Добавить объявление</button>
      {msg && <p className="text-gold text-xs mt-2">{msg}</p>}

      {items.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((a) => {
            const live = a.is_active && new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() > now;
            const over = new Date(a.ends_at).getTime() <= now;
            return (
              <div key={a.id} className="border border-muted rounded-lg p-3">
                <p className="text-offwhite text-sm font-semibold">{a.title}</p>
                <p className="text-muted text-xs">{fmt(a.starts_at)} — {fmt(a.ends_at)} · {a.audience.map((x) => ({ teen: "TEEN", main: "MISS", adult: "LADY" } as Record<string, string>)[x]).join(", ")} · {a.all_regions === false ? `регионы: ${(a.region_ids ?? []).map((id) => regions.find((x) => x.id === id)?.name ?? "").filter(Boolean).join(", ") || "—"}` : "вся страна"}</p>
                <p className={`text-xs mt-1 ${live ? "text-success" : "text-muted"}`}>{live ? "● Сейчас показывается" : over ? "Завершено" : a.is_active ? "Ожидает начала" : "Выключено"}</p>
                <div className="flex gap-2 mt-2">
                  {!over && <button onClick={() => act({ action: "toggle", id: a.id, active: !a.is_active })} className="text-xs px-3 py-1 rounded-full border border-gold text-gold">{a.is_active ? "Выключить" : "Включить"}</button>}
                  <button onClick={() => act({ action: "delete", id: a.id })} className="text-xs px-3 py-1 rounded-full border border-danger text-danger">Удалить</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Яркая полоса на главной (в конструкторе шоу: настройки блока «Яркая полоса»).
export function StripBlock() {
  const [v, setV] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const cc = getCrmCountry() || null;
  useEffect(() => {
    (async () => {
      setV(await loadScoped(["strip_enabled", "strip_text"], cc));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function save() {
    await supabase.from("platform_settings").upsert(["strip_enabled", "strip_text"].map((k) => ({ key: scopedKey(k, cc), value: v[k] ?? "" })));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  if (!ready) return <p className="text-muted text-sm">Загрузка...</p>;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-offwhite text-sm">
        <input type="checkbox" checked={v.strip_enabled === "true"} onChange={(e) => setV((p) => ({ ...p, strip_enabled: e.target.checked ? "true" : "false" }))} />
        Показывать полосу (в последние 3 часа перед воскресным отсевом)
      </label>
      <input
        value={v.strip_text ?? ""}
        onChange={(e) => setV((p) => ({ ...p, strip_text: e.target.value }))}
        placeholder="🔥 До отсева недели: {time}"
        className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-base text-offwhite"
      />
      <p className="text-muted text-xs">Вместо {"{time}"} подставится обратный отсчёт. Пусто: стандартный текст.</p>
      <button onClick={save} className="bg-gold text-black font-semibold rounded-lg px-4 py-2 text-sm">
        {saved ? "Сохранено ✓" : "Сохранить"}
      </button>
    </div>
  );
}
