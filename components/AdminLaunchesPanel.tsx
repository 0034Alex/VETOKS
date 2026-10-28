"use client";

import { useEffect, useMemo, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";
import {
  BLOCKS,
  KIND_LABEL,
  activeItems,
  dayIdx,
  effState,
  idxToShort,
  idxToStr,
  itemRange,
  stageAt,
  stageRange,
  totalDays,
  type ItemRow,
  type LaunchRow,
  type Stage,
} from "@/lib/launch";

type Country = { id: string; name: string };
type ShowOpt = { key: string; title: string };

const STATE_LABEL: Record<string, string> = {
  draft: "Черновик",
  waiting: "Запланирован",
  live: "Идёт",
  paused: "На паузе",
  finished: "Закончен",
};
const STATE_CLS: Record<string, string> = {
  draft: "bg-muted/20 text-muted",
  waiting: "bg-blue-500/20 text-blue-300",
  live: "bg-green-500/20 text-green-300",
  paused: "bg-orange-500/20 text-orange-300",
  finished: "bg-muted/20 text-muted",
};

const inp = "w-full bg-bgPrimary border border-muted/60 rounded-lg px-2.5 py-2 text-sm text-offwhite min-w-0";
const btn = "px-3 py-2 rounded-lg border border-muted/60 text-sm text-offwhite whitespace-nowrap";
const btnGold = "px-3 py-2 rounded-lg bg-gold text-black text-sm font-semibold whitespace-nowrap";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`relative w-11 h-6 rounded-full flex-none transition-colors ${on ? "bg-green-500" : "bg-muted/50"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function AdminLaunchesPanel({
  allowedIds = null,
  isOwner = false,
  onGo,
  canOpen,
}: {
  allowedIds?: string[] | null;
  isOwner?: boolean;
  onGo?: (t: string) => void;
  canOpen?: (t: string) => boolean;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [cid, setCid] = useState("");
  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [shows, setShows] = useState<ShowOpt[]>([]);
  const [newShow, setNewShow] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pub, setPub] = useState<{ count: number; launches: number; blocks: string[] } | null>(null);
  const [money, setMoney] = useState<{ rate: string; cur: string }>({ rate: "", cur: "" });

  async function loadPub() {
    if (!isOwner) return;
    const r = await apiPost("/api/admin/launches", { action: "publish_preview" });
    if (r?.ok) setPub({ count: r.count, launches: r.launches, blocks: r.blocks });
  }
  async function doPublish() {
    const r = await apiPost("/api/admin/launches", { action: "publish" });
    if (!r?.ok) return flash(r?.message || "Не получилось.");
    flash(r.count ? `Опубликовано: добавлено блоков ${r.count} в ${r.launches} запусках.` : "Нечего добавлять — всё уже есть.");
    await load();
    await loadPub();
  }

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 4000);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("countries").select("id, name").order("name");
      const list = ((data as Country[]) ?? []).filter((c) => !allowedIds || allowedIds.includes(c.id));
      setCountries(list);
      const saved = getCrmCountry();
      setCid(list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? "");
    })();
  }, []);

  async function load(c = cid) {
    if (!c) return;
    setLoading(true);
    const r = await apiPost("/api/admin/launches", { action: "list", country_id: c });
    setLoading(false);
    if (!r?.ok) return flash(r?.message || "Не получилось загрузить.");
    setLaunches(r.launches ?? []);
    setItems(r.items ?? []);
    setShows(r.shows ?? []);
    if (!newShow && r.shows?.[0]) setNewShow(r.shows[0].key);
  }
  useEffect(() => {
    load();
    loadPub();
    (async () => {
      if (!cid) return;
      const { data: st } = await supabase.from("platform_settings").select("key, value").in("key", [`usd_to_uah_rate:${cid}`, "usd_to_uah_rate"]);
      const m: Record<string, string> = {};
      (st ?? []).forEach((x: any) => (m[x.key] = x.value));
      const { data: c } = await supabase.from("countries").select("currency_symbol").eq("id", cid).maybeSingle();
      setMoney({ rate: m[`usd_to_uah_rate:${cid}`] || "", cur: (c as any)?.currency_symbol || "" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  async function act(body: Record<string, unknown>, ok?: string) {
    const r = await apiPost("/api/admin/launches", body);
    if (!r?.ok) {
      flash(r?.message || "Не получилось.");
      return false;
    }
    if (ok) flash(ok);
    await load();
    return true;
  }

  const showTitle = (k: string) => shows.find((s) => s.key === k)?.title || k;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 text-sm text-offwhite space-y-1">
        <p className="font-semibold">Как пользоваться, три шага:</p>
        <p>1. Выберите страну и добавьте шоу.</p>
        <p>2. Откройте шоу, поставьте дату старта.</p>
        <p>3. Нажмите «Старт». Дальше всё идёт само по дням.</p>
        <p className="text-xs text-muted">Остальное (подсказки, вопросы, блоки) по желанию, всё внутри шоу. Публикация, курс и копирование — внизу в «Ещё».</p>
      </div>
      <div className="bg-bgSurface border border-muted/40 rounded-xl p-3 space-y-3">
        <div className="flex gap-2 flex-wrap items-end">
          <label className="flex-1 min-w-[160px] text-xs text-muted space-y-1">
            Страна
            <select className={inp} value={cid} onChange={(e) => setCid(e.target.value)}>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[160px] text-xs text-muted space-y-1">
            Добавить шоу в очередь
            <select className={inp} value={newShow} onChange={(e) => setNewShow(e.target.value)}>
              {shows.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <button className={btnGold} onClick={() => act({ action: "create", country_id: cid, show_key: newShow }, "Добавлено в очередь.")}>
            + Добавить
          </button>
        </div>
        <p className="text-[11px] text-muted">
          В стране идёт одно шоу за раз. Пока в стране нет ни одного запуска, приложение работает как раньше (по датам в разделе «Шоу»). Как только добавите запуск, шоу в этой стране выбирает он.
        </p>
        {msg && <p className="text-sm text-gold">{msg}</p>}
      </div>

      <details className="bg-bgSurface border border-muted/40 rounded-xl p-3">
        <summary className="cursor-pointer text-sm font-semibold text-offwhite">Ещё: публикация шаблона, курс, документы, реклама</summary>
        <div className="space-y-3 mt-3">
      {isOwner && (
        <div className="border border-muted/40 rounded-xl p-3 space-y-2">
          <h3 className="text-sm font-semibold text-offwhite">Опубликовать шаблон</h3>
          <p className="text-[11px] text-muted">
            Новые блоки приложения добавляются сюда кодом. Кнопка добавляет их во все запуски всех стран. Что страны уже внесли (тексты, вопросы, подсказки, свои выключатели) не меняется.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button className={pub && pub.count > 0 ? btnGold : btn} onClick={doPublish}>
              📤 Опубликовать
            </button>
            <span className="text-xs text-muted">
              {pub ? (pub.count > 0 ? `Ждёт публикации: ${pub.blocks.map((k) => BLOCKS.find((b) => b.key === k)?.label ?? k).join(", ")} (запусков: ${pub.launches})` : "Всё опубликовано, новых блоков нет.") : ""}
            </span>
          </div>
        </div>
      )}

      <div className="border border-muted/40 rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold text-offwhite">Деньги, документы и реклама этой страны</h3>
        <p className="text-xs text-offwhite">
          Курс: {money.rate ? `1 $ = ${money.rate} ${money.cur}` : "не задан (берётся общий)"}. Цены в долларах, в приложении показываются в валюте страны, внутри всё через монету.
        </p>
        {typeof window !== "undefined" && getCrmCountry() !== cid && (
          <p className="text-[11px] text-orange-300">Чтобы открыть разделы ниже для этой страны, выберите её в шапке CRM (вверху).</p>
        )}
        <div className="flex gap-2 flex-wrap">
          {[
            ["app-prices", "Курс и цены"],
            ["documents", "Документы"],
            ["banners", "Баннеры"],
            ["ad-space", "Реклама и места"],
            ["calendar", "Подсказки (календарь)"],
            ["countries", "Страны и регионы"],
          ]
            .filter(([t]) => !canOpen || canOpen(t))
            .map(([t, label]) => (
              <button key={t} className={btn} onClick={() => onGo?.(t)}>
                {label} →
              </button>
            ))}
        </div>
      </div>
        </div>
      </details>

      {loading && <p className="text-sm text-muted">Загрузка…</p>}
      {!loading && launches.length === 0 && <p className="text-sm text-muted">В этой стране пока нет запусков. Добавьте первое шоу.</p>}

      {launches.map((l, idx) => (
        <LaunchCard
          key={l.id}
          l={l}
          index={idx}
          all={launches}
          items={items.filter((i) => i.launch_id === l.id)}
          shows={shows}
          title={showTitle(l.show_key)}
          countries={countries}
          cid={cid}
          act={act}
        />
      ))}
    </div>
  );
}

function LaunchCard({
  l,
  index,
  all,
  items,
  shows,
  title,
  countries,
  cid,
  act,
}: {
  l: LaunchRow;
  index: number;
  all: LaunchRow[];
  items: ItemRow[];
  shows: ShowOpt[];
  title: string;
  countries: Country[];
  cid: string;
  act: (b: Record<string, unknown>, ok?: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(index === 0);
  const [stages, setStages] = useState<Stage[]>(l.stages);
  const [tz, setTz] = useState(l.tz);
  const [startMode, setStartMode] = useState<"date" | "after">(l.after_id ? "after" : "date");
  const [date, setDate] = useState(l.start_date ?? "");
  const [afterId, setAfterId] = useState(l.after_id ?? "");
  const [offset, setOffset] = useState(String(l.after_offset ?? 0));
  const [previewDate, setPreviewDate] = useState("");
  const [copyTo, setCopyTo] = useState("");

  useEffect(() => {
    setStages(l.stages);
    setTz(l.tz);
    setStartMode(l.after_id ? "after" : "date");
    setDate(l.start_date ?? "");
    setAfterId(l.after_id ?? "");
    setOffset(String(l.after_offset ?? 0));
  }, [l]);

  const now = Math.floor(Date.now() / 86400000);
  const eff = effState({ ...l, stages }, all, now);
  const S = eff.S;
  const E = eff.E;
  const total = totalDays({ stages });
  const others = all.filter((x) => x.id !== l.id);
  const pIdx = previewDate ? dayIdx(previewDate) : null;

  async function saveSchedule() {
    await act(
      {
        action: "save",
        id: l.id,
        stages,
        tz,
        start_date: startMode === "date" ? date || null : null,
        after_id: startMode === "after" ? afterId || null : null,
        after_offset: Number(offset) || 0,
      },
      "Сохранено."
    );
  }

  function setStage(i: number, p: Partial<Stage>) {
    setStages((s) => s.map((x, k) => (k === i ? { ...x, ...p } : x)));
  }

  const groups: { kind: string; list: ItemRow[] }[] = ["block", "tip", "question", "task"].map((k) => ({ kind: k, list: items.filter((i) => i.kind === k) }));
  const freeBlocks = BLOCKS.filter((b) => !items.some((i) => i.kind === "block" && i.block_key === b.key));
  const active = pIdx !== null && S !== null ? activeItems({ ...l, stages }, items, S, pIdx) : [];
  const pStage = pIdx !== null && S !== null ? stageAt({ ...l, stages }, S, pIdx) : null;

  return (
    <div className="bg-bgSurface border border-muted/40 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-3 flex items-center gap-2 flex-wrap">
        <span className="text-offwhite font-semibold">
          {index + 1}. {title}
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATE_CLS[eff.state]}`}>{STATE_LABEL[eff.state]}</span>
        <span className="text-xs text-muted">{S !== null && E !== null ? `${idxToShort(S)} – ${idxToShort(E)} · ${total} дн.` : "дата не задана"}</span>
        <span className="ml-auto text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-4">
          {/* Кнопки управления */}
          <div className="flex gap-2 flex-wrap">
            {l.status !== "live" && (
              <button className={btnGold} onClick={() => act({ action: "status", id: l.id, status: "live" }, "Запуск включён.")}>
                ▶ Старт
              </button>
            )}
            {l.status === "live" && (
              <button className={btn} onClick={() => act({ action: "status", id: l.id, status: "paused" }, "Поставлено на паузу.")}>
                ⏸ Пауза
              </button>
            )}
            {l.status !== "draft" && (
              <button className={btn} onClick={() => act({ action: "status", id: l.id, status: "draft" }, "Возвращено в черновик.")}>
                ✎ В черновик
              </button>
            )}
            <button className={btn} onClick={() => act({ action: "shift", id: l.id, days: -1 }, "Сдвинуто на день раньше.")}>
              ← −1 день
            </button>
            <button className={btn} onClick={() => act({ action: "shift", id: l.id, days: 1 }, "Сдвинуто на день позже.")}>
              +1 день →
            </button>
            <button className={btn} onClick={() => act({ action: "status", id: l.id, status: "finished" }, "Запуск закончен.")}>
              ■ Закончить
            </button>
          </div>

          {/* Старт и этапы */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-offwhite">1. Старт и этапы</h3>
            <p className="text-[11px] text-muted">Когда начинается шоу и сколько дней идёт каждый этап.</p>
            <div className="flex gap-2 flex-wrap items-end">
              <label className="text-xs text-muted space-y-1 flex-1 min-w-[150px]">
                Старт
                <select className={inp} value={startMode} onChange={(e) => setStartMode(e.target.value as "date" | "after")}>
                  <option value="date">в конкретную дату</option>
                  <option value="after" disabled={others.length === 0}>
                    после другого шоу этой страны
                  </option>
                </select>
              </label>
              {startMode === "date" ? (
                <label className="text-xs text-muted space-y-1 flex-1 min-w-[150px]">
                  Дата старта
                  <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              ) : (
                <>
                  <label className="text-xs text-muted space-y-1 flex-1 min-w-[150px]">
                    После шоу
                    <select className={inp} value={afterId} onChange={(e) => setAfterId(e.target.value)}>
                      <option value="">—</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {shows.find((s) => s.key === o.show_key)?.title || o.show_key}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted space-y-1 w-28">
                    Через дней
                    <input type="number" className={inp} value={offset} onChange={(e) => setOffset(e.target.value)} />
                  </label>
                </>
              )}
              <label className="text-xs text-muted space-y-1 flex-1 min-w-[150px]">
                Часовой пояс страны
                <input className={inp} value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Europe/Kyiv" />
              </label>
            </div>
            <div className="space-y-1.5">
              {stages.map((s, i) => {
                const r = S !== null ? stageRange({ ...l, stages }, S, i) : null;
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <input className={`${inp} flex-1`} value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} />
                    <input type="number" min={1} className={`${inp} w-20`} value={s.days} onChange={(e) => setStage(i, { days: Number(e.target.value) })} />
                    <span className="text-xs text-muted w-24 flex-none">{r ? `${idxToShort(r[0])}–${idxToShort(r[1])}` : "дней"}</span>
                    <button className="text-muted px-1" onClick={() => setStages((x) => x.filter((_, k) => k !== i))} aria-label="Убрать этап">
                      ✕
                    </button>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button className={btn} onClick={() => setStages((x) => [...x, { name: "Новый этап", days: 7 }])}>
                  + Этап
                </button>
                <button className={btnGold} onClick={saveSchedule}>
                  Сохранить старт и этапы
                </button>
              </div>
            </div>
          </div>

          {/* Пункты программы */}
          {groups.map((g) => (
            <div key={g.kind} className="space-y-2">
              <h3 className="text-sm font-semibold text-offwhite">{g.kind === "block" ? "2. Что видят люди (включить или выключить)" : g.kind === "tip" ? "3. Подсказки участникам по дням" : g.kind === "question" ? "Вопросы зрителям по дням" : "Задания по дням"}</h3>
              {g.list.length === 0 && g.kind !== "block" && <p className="text-xs text-muted">Пока нет.</p>}
              {g.list.map((it) => (
                <ItemEditor key={it.id + "-" + it.start_mode + it.stage} launch={{ ...l, stages }} S={S} it={it} act={act} />
              ))}
              {g.kind === "block" ? (
                freeBlocks.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {freeBlocks.map((b) => (
                      <button
                        key={b.key}
                        className={btn}
                        onClick={() => act({ action: "item_save", launch_id: l.id, kind: "block", block_key: b.key, stage: b.stage, enabled: true, start_mode: b.start_mode, start_n: b.start_n, dur_mode: b.dur_mode, dur_n: b.dur_n, sort: 9 }, "Добавлено.")}
                      >
                        + {b.label}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <button
                  className={btn}
                  onClick={() => act({ action: "item_save", launch_id: l.id, kind: g.kind, title: "", body: "", stage: 0, enabled: true, start_mode: "from", start_n: 0, dur_mode: "days", dur_n: 7, sort: 10 + g.list.length }, "Добавлено — заполните текст.")}
                >
                  + {KIND_LABEL[g.kind]}
                </button>
              )}
            </div>
          ))}

          <details className="border-t border-muted/30 pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-offwhite">Ещё: посмотреть день, скопировать, удалить</summary>
          {/* Предпросмотр дня */}
          <div className="space-y-2 pt-3">
            <h3 className="text-sm font-semibold text-offwhite">Что будет в выбранный день</h3>
            <input type="date" className={inp} value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} />
            {pIdx !== null && (
              <div className="text-sm space-y-1">
                <p className="text-gold">{pStage ? `${pStage.name} · день ${pStage.day} из ${total}` : "Вне этого шоу"}</p>
                {active.length === 0 && <p className="text-muted">В этот день ничего не включено.</p>}
                {active.map((a) => (
                  <p key={a.id} className="text-offwhite">
                    • {a.kind === "block" ? BLOCKS.find((b) => b.key === a.block_key)?.label : KIND_LABEL[a.kind] + ": " + (a.body || a.title || "—")}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Копия и удаление */}
          <div className="flex gap-2 flex-wrap items-end border-t border-muted/30 pt-3">
            <label className="text-xs text-muted space-y-1 flex-1 min-w-[160px]">
              Скопировать программу в другую страну (черновиком)
              <select className={inp} value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>
                <option value="">— выберите страну —</option>
                {countries
                  .filter((c) => c.id !== cid)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className={btn} disabled={!copyTo} onClick={() => act({ action: "copy", id: l.id, country_id: copyTo }, "Скопировано. Откройте ту страну и задайте старт.")}>
              Скопировать
            </button>
            <button
              className="px-3 py-2 rounded-lg border border-red-500/50 text-sm text-red-300"
              onClick={() => {
                if (window.confirm("Удалить этот запуск и его программу?")) act({ action: "delete", id: l.id }, "Удалено.");
              }}
            >
              Удалить запуск
            </button>
          </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ItemEditor({ launch, S, it, act }: { launch: LaunchRow; S: number | null; it: ItemRow; act: (b: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const [d, setD] = useState<ItemRow>(it);
  const dirty = JSON.stringify(d) !== JSON.stringify(it);
  const isBlock = d.kind === "block";
  const range = S !== null ? itemRange(launch, S, d) : null;
  const set = (p: Partial<ItemRow>) => setD((x) => ({ ...x, ...p }));
  const save = (next: ItemRow = d, ok = "Сохранено.") => act({ action: "item_save", ...next }, ok);

  return (
    <div className={`border border-muted/40 rounded-xl p-2.5 space-y-2 ${d.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-offwhite min-w-0">{isBlock ? BLOCKS.find((b) => b.key === d.block_key)?.label ?? d.block_key : KIND_LABEL[d.kind]}</span>
        <Toggle
          on={d.enabled}
          onChange={(v) => {
            const n = { ...d, enabled: v };
            setD(n);
            save(n, v ? "Включено." : "Выключено.");
          }}
        />
      </div>
      {!isBlock && (
        <textarea
          className={`${inp} min-h-[60px]`}
          placeholder={d.kind === "question" ? "Текст вопроса для опроса" : d.kind === "tip" ? "Подсказка участникам" : "Текст задания"}
          value={d.body}
          onChange={(e) => set({ body: e.target.value })}
        />
      )}
      <div className="flex gap-2 flex-wrap">
        <label className="text-[11px] text-muted space-y-1 flex-1 min-w-[110px]">
          Этап
          <select className={inp} value={d.stage} onChange={(e) => set({ stage: Number(e.target.value) })}>
            <option value={-1}>Весь запуск</option>
            {launch.stages.map((s, i) => (
              <option key={i} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-muted space-y-1 flex-[2] min-w-[170px]">
          Начало
          <select className={inp} value={d.start_mode} onChange={(e) => set({ start_mode: e.target.value })}>
            <option value="from">через N дней после начала этапа</option>
            <option value="end">за N дней до конца этапа</option>
            <option value="before">за N дней до старта шоу</option>
          </select>
        </label>
        <label className="text-[11px] text-muted space-y-1 w-20">
          N дней
          <input type="number" min={0} className={inp} value={d.start_n} onChange={(e) => set({ start_n: Number(e.target.value) })} />
        </label>
        <label className="text-[11px] text-muted space-y-1 flex-1 min-w-[120px]">
          Длится
          <select className={inp} value={d.dur_mode} onChange={(e) => set({ dur_mode: e.target.value })}>
            <option value="stage">до конца этапа</option>
            <option value="days">N дней</option>
          </select>
        </label>
        {d.dur_mode === "days" && (
          <label className="text-[11px] text-muted space-y-1 w-20">
            Дней
            <input type="number" min={1} className={inp} value={d.dur_n} onChange={(e) => set({ dur_n: Number(e.target.value) })} />
          </label>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs bg-green-500/15 text-green-300 rounded-lg px-2 py-1">{range ? `= ${idxToShort(range[0])} – ${idxToShort(range[1])}` : "дата появится после задания старта"}</span>
        {dirty && (
          <button className={btnGold} onClick={() => save()}>
            Сохранить
          </button>
        )}
        {!isBlock && (
          <button className="text-xs text-red-300 ml-auto" onClick={() => act({ action: "item_delete", id: d.id }, "Удалено.")}>
            Удалить
          </button>
        )}
      </div>
    </div>
  );
}
