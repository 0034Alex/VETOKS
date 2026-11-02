"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { BLOCKS, blockFits, effState, idxToShort, idxToStr, stageRange, todayIdx, totalDays, type ItemRow, type LaunchRow, type Stage } from "@/lib/launch";

// Страница «Шоу»: вкладки по времени (идёт / дальше / прошедшие), у каждого шоу карточка с понятными кнопками.
// Работает с теми же запусками, что и старый раздел «Страны и запуск».

type Country = { id: string; name: string; code?: string | null };
type ShowOpt = { key: string; title: string };
type Tab = "now" | "next" | "past";
type Act = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

const inp = "bg-bgPrimary border border-muted/60 rounded-lg px-2.5 py-2 text-sm text-offwhite min-w-0";
const btn = "px-3 py-2 rounded-lg border border-muted/60 text-sm text-offwhite whitespace-nowrap";
const btnGold = "px-3 py-2 rounded-lg bg-gold text-black text-sm font-semibold whitespace-nowrap";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className={`relative w-11 h-6 rounded-full flex-none transition-colors ${on ? "bg-green-500" : "bg-muted/50"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function stageIndex(l: LaunchRow, S: number, today: number): number {
  for (let i = 0; i < l.stages.length; i++) if (today <= stageRange(l, S, i)[1]) return i;
  return Math.max(0, l.stages.length - 1);
}

export default function AdminShowsHub({
  allowedIds = null,
  onGo,
}: {
  allowedIds?: string[] | null;
  onGo?: (t: string) => void;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [cid, setCid] = useState("");
  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [shows, setShows] = useState<ShowOpt[]>([]);
  const [tab, setTab] = useState<Tab>("now");
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 5000);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("countries").select("id, name, code").order("name");
      const list = ((data as Country[]) ?? []).filter((c) => !allowedIds || allowedIds.includes(c.id));
      setCountries(list);
      const saved = getCrmCountry();
      setCid(list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const act: Act = async (body, ok) => {
    const r = await apiPost("/api/admin/launches", body);
    if (!r?.ok) {
      flash(r?.message || "Не получилось.");
      return false;
    }
    flash(r.message || ok || "");
    await load();
    return true;
  };

  const title = (k: string) => shows.find((s) => s.key === k)?.title || k;
  const rows = launches.map((l) => {
    const e = effState(l, launches, todayIdx(l.tz));
    return { l, e, today: todayIdx(l.tz) };
  });
  const group = (r: (typeof rows)[number]): Tab => (r.e.state === "live" || r.e.state === "paused" ? "now" : r.e.state === "finished" ? "past" : "next");
  const counts = { now: rows.filter((r) => group(r) === "now").length, next: rows.filter((r) => group(r) === "next").length, past: rows.filter((r) => group(r) === "past").length };
  const shown = rows
    .filter((r) => group(r) === tab)
    .sort((a, b) => (tab === "past" ? (b.e.E ?? 0) - (a.e.E ?? 0) : (a.e.S ?? 9e9) - (b.e.S ?? 9e9)));
  const TABS: [Tab, string][] = [
    ["now", "Идёт сейчас"],
    ["next", "Дальше"],
    ["past", "Прошедшие"],
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="text-xs text-muted space-y-1 flex-1 min-w-[160px]">
          Страна
          <select className={`${inp} w-full`} value={cid} onChange={(e) => setCid(e.target.value)}>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className={btnGold} onClick={() => setAdding(!adding)}>
          ＋ Новое шоу
        </button>
      </div>

      {adding && (
        <NewShow
          shows={shows}
          hasPrev={launches.length > 0}
          cid={cid}
          onDone={async (m, goTab) => {
            setAdding(false);
            if (m) flash(m);
            await load();
            if (goTab) setTab(goTab);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {msg && <p className="text-sm text-gold">{msg}</p>}

      <div className="flex gap-1 bg-bgSurface border border-muted/40 rounded-xl p-1">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              setOpenId(null);
            }}
            className={`flex-1 px-2 py-2 rounded-lg text-sm whitespace-nowrap ${tab === k ? "bg-gold text-black font-bold" : "text-muted"}`}
          >
            {label} <span className="opacity-70 font-normal">{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted">Загрузка…</p>}
      {!loading && shown.length === 0 && (
        <p className="text-sm text-muted text-center border border-dashed border-muted/50 rounded-xl p-6">
          {tab === "now" ? "Сейчас в этой стране ничего не идёт. Запустите шоу из «Дальше» или нажмите «＋ Новое шоу»." : tab === "next" ? "Очередь пуста. Нажмите «＋ Новое шоу»." : "Закончившихся шоу пока нет."}
        </p>
      )}

      <div className="space-y-2.5">
        {shown.map((r) => (
          <ShowCard
            key={r.l.id}
            l={r.l}
            S={r.e.S}
            E={r.e.E}
            state={r.e.state}
            today={r.today}
            title={title(r.l.show_key)}
            items={items.filter((i) => i.launch_id === r.l.id)}
            open={openId === r.l.id}
            onToggle={() => setOpenId(openId === r.l.id ? null : r.l.id)}
            act={act}
            flash={flash}
            countries={countries}
            cid={cid}
            onGo={onGo}
          />
        ))}
      </div>
    </div>
  );
}

function NewShow({ shows, hasPrev, cid, onDone, onCancel }: { shows: ShowOpt[]; hasPrev: boolean; cid: string; onDone: (msg: string, tab?: Tab) => void; onCancel: () => void }) {
  const [key, setKey] = useState(shows[0]?.key ?? "");
  const [mode, setMode] = useState<"date" | "after">(hasPrev ? "after" : "date");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!key) return;
    if (mode === "date" && !date) return onDone("Укажите дату старта.");
    setBusy(true);
    const r = await apiPost("/api/admin/launches", { action: "create", country_id: cid, show_key: key });
    if (!r?.ok || !r.id) {
      setBusy(false);
      return onDone(r?.message || "Не получилось создать.");
    }
    if (mode === "date") await apiPost("/api/admin/launches", { action: "save", id: r.id, start_date: date, after_id: null });
    // В очередь: включаем по расписанию, чтобы шоу само стартовало в свой день.
    const s = await apiPost("/api/admin/launches", { action: "status", id: r.id, status: "live" });
    setBusy(false);
    onDone(s?.ok ? "Шоу добавлено в «Дальше» и стартует по расписанию." : `Шоу добавлено, но не включено: ${s?.message || ""}`, "next");
  }
  return (
    <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 space-y-3">
      <p className="text-offwhite font-semibold">Новое шоу</p>
      <div className="flex gap-2 flex-wrap">
        <label className="text-xs text-muted space-y-1 flex-1 min-w-[150px]">
          Какое шоу
          <select className={`${inp} w-full`} value={key} onChange={(e) => setKey(e.target.value)}>
            {shows.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted space-y-1 flex-1 min-w-[150px]">
          Старт
          <select className={`${inp} w-full`} value={mode} onChange={(e) => setMode(e.target.value as "date" | "after")}>
            <option value="date">в конкретную дату</option>
            <option value="after" disabled={!hasPrev}>
              сразу после предыдущего шоу страны
            </option>
          </select>
        </label>
        {mode === "date" && (
          <label className="text-xs text-muted space-y-1 min-w-[150px]">
            Дата старта
            <input type="date" className={`${inp} w-full`} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
      </div>
      <p className="text-[11px] text-muted">Этапы по умолчанию: Отбор 14 дн., Голосование 21 дн., Финал 7 дн. Поменять можно в карточке шоу.</p>
      <div className="flex gap-2 justify-end">
        <button className={btn} onClick={onCancel}>
          Отмена
        </button>
        <button className={btnGold} disabled={busy} onClick={create}>
          Добавить в «Дальше»
        </button>
      </div>
    </div>
  );
}

function ShowCard({
  l,
  S,
  E,
  state,
  today,
  title,
  items,
  open,
  onToggle,
  act,
  flash,
  countries,
  cid,
  onGo,
}: {
  l: LaunchRow;
  S: number | null;
  E: number | null;
  state: string;
  today: number;
  title: string;
  items: ItemRow[];
  open: boolean;
  onToggle: () => void;
  act: Act;
  flash: (t: string) => void;
  countries: Country[];
  cid: string;
  onGo?: (t: string) => void;
}) {
  const [stages, setStages] = useState<Stage[]>(l.stages ?? []);
  const [ext, setExt] = useState("3");
  const [useDate, setUseDate] = useState(!l.after_id);
  const [date, setDate] = useState(S !== null ? idxToStr(S) : "");
  const [copyTo, setCopyTo] = useState("");
  const key = JSON.stringify(l.stages) + (l.start_date ?? "") + (l.after_id ?? "");
  useEffect(() => {
    setStages(l.stages ?? []);
    setUseDate(!l.after_id);
    setDate(S !== null ? idxToStr(S) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const total = totalDays(l);
  const ci = S !== null ? stageIndex(l, S, today) : 0;
  const cur = country(countries, cid);
  const n = Math.max(1, Math.floor(Number(ext) || 1));
  const startToday = { action: "save", id: l.id, start_date: idxToStr(today), after_id: null, after_offset: 0 };

  const sub =
    state === "live" && S !== null
      ? `Этап ${ci + 1} из ${l.stages.length} «${l.stages[ci]?.name ?? ""}» · закончится ${idxToShort(stageRange(l, S, ci)[1])}`
      : state === "paused"
      ? `На паузе · этап ${ci + 1} из ${l.stages.length}`
      : state === "finished" && E !== null
      ? `Закончилось ${idxToShort(E)} · ${total} дн.`
      : S !== null
      ? `${state === "draft" ? "Не включено" : "Старт"} ${idxToShort(S)} · ${total} дн. · этапов ${l.stages.length}`
      : "Дата старта не задана";
  const pill =
    state === "live" ? ["ИДЁТ", "text-green-300"] : state === "paused" ? ["ПАУЗА", "text-orange-300"] : state === "finished" ? ["ЗАКОНЧЕНО", "text-muted"] : state === "draft" ? ["ЧЕРНОВИК", "text-muted"] : ["ЖДЁТ", "text-blue-300"];

  async function extend() {
    if (S === null) return;
    const next = stages.map((s) => ({ ...s }));
    if (state === "finished" && E !== null) {
      // Продлеваем последний этап так, чтобы шоу шло ещё n дней считая от сегодня.
      next[next.length - 1].days = Math.max(1, Number(next[next.length - 1].days) || 1) + Math.max(0, today - E) + n;
    } else {
      next[ci].days = Math.max(1, Number(next[ci].days) || 1) + n;
    }
    const ok = await act({ action: "save", id: l.id, stages: next }, "");
    if (ok && l.status !== "live") await act({ action: "status", id: l.id, status: "live" }, `Шоу продлено и снова идёт (ещё ${n} дн.).`);
    else if (ok) flash(`Этап продлён на ${n} дн.`);
  }
  async function nextStage() {
    if (S === null) return;
    const r = stageRange(l, S, ci);
    const d = today - r[0];
    if (d < 1) return flash("Этот этап начался сегодня. Переключить на следующий можно со следующего дня.");
    const next = stages.map((s) => ({ ...s }));
    next[ci].days = d;
    await act({ action: "save", id: l.id, stages: next }, "Следующий этап включён.");
  }
  async function startNow(msg: string) {
    const ok = await act(startToday, "");
    if (ok) await act({ action: "status", id: l.id, status: "live" }, msg);
  }
  async function saveDates() {
    const body: Record<string, unknown> = { action: "save", id: l.id, stages };
    if (useDate && date) {
      body.start_date = date;
      body.after_id = null;
    } else if (!useDate) body.after_id = l.after_id;
    await act(body, "Даты сохранены.");
  }

  // Блоки приложения, включённые в это шоу, по группам.
  const blocks = items.filter((i) => i.kind === "block" && blockFits(i.block_key ?? "", l.show_key));
  const labelOf = (k: string | null) => BLOCKS.find((b) => b.key === k)?.label ?? String(k);
  const groups: Record<string, ItemRow[]> = {};
  blocks.forEach((b) => {
    const lb = labelOf(b.block_key);
    const g = lb.includes(":") ? lb.split(":")[0] : "Главная";
    (groups[g] = groups[g] || []).push(b);
  });
  const onCount = blocks.filter((b) => b.enabled).length;

  const stateBox =
    state === "live" ? (
      <>
        <p className="text-sm text-offwhite">
          Сейчас этап «{l.stages[ci]?.name}», осталось дней: {S !== null ? stageRange(l, S, ci)[1] - today + 1 : "—"}.
        </p>
        <div className="flex gap-2 flex-wrap items-center">
          <button className={btnGold} onClick={extend}>
            Продлить этап на
          </button>
          <input type="number" min={1} className={`${inp} w-20`} value={ext} onChange={(e) => setExt(e.target.value)} />
          <span className="text-sm text-muted">дн.</span>
          {ci < l.stages.length - 1 && (
            <button className={btn} onClick={nextStage}>
              Следующий этап сейчас
            </button>
          )}
          <button className={btn} onClick={() => act({ action: "status", id: l.id, status: "paused" }, "Шоу на паузе.")}>
            ⏸ Пауза
          </button>
        </div>
      </>
    ) : state === "paused" ? (
      <>
        <p className="text-sm text-offwhite">Шоу на паузе. Участники видят его без изменений.</p>
        <div className="flex gap-2 flex-wrap">
          <button className={btnGold} onClick={() => act({ action: "status", id: l.id, status: "live" }, "Шоу продолжается.")}>
            ▶ Продолжить
          </button>
        </div>
      </>
    ) : state === "finished" ? (
      <>
        <p className="text-sm text-offwhite">Шоу закончилось{E !== null ? ` ${idxToShort(E)}` : ""}. Победительницы определяются сами.</p>
        <div className="flex gap-2 flex-wrap items-center">
          <button className={btnGold} onClick={extend}>
            Продлить последний этап на
          </button>
          <input type="number" min={1} className={`${inp} w-20`} value={ext} onChange={(e) => setExt(e.target.value)} />
          <span className="text-sm text-muted">дн. от сегодня</span>
          <button className={btn} onClick={() => startNow("Шоу началось заново с сегодняшнего дня.")}>
            Начать заново с сегодня
          </button>
        </div>
      </>
    ) : (
      <>
        <p className="text-sm text-offwhite">{S !== null ? `Старт ${idxToShort(S)}.` : "Сначала задайте дату старта ниже."}</p>
        <div className="flex gap-2 flex-wrap">
          <button className={btnGold} onClick={() => startNow("Шоу запущено сегодня.")}>
            ▶ Запустить сегодня
          </button>
          {state === "draft" && S !== null && (
            <button className={btn} onClick={() => act({ action: "status", id: l.id, status: "live" }, "Включено: шоу стартует по расписанию.")}>
              Включить по расписанию
            </button>
          )}
        </div>
      </>
    );

  return (
    <div className="bg-bgSurface border border-muted/40 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-3 flex items-center gap-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-offwhite font-semibold truncate">
            {title} · {cur?.name ?? ""}
          </span>
          <span className="block text-xs text-muted">{sub}</span>
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border border-current flex-none ${pill[1]}`}>{pill[0]}</span>
        <span className="text-muted flex-none">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-4">
          <div className="border border-muted/40 rounded-xl p-3 space-y-2.5 bg-bgPrimary">{stateBox}</div>

          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted">Даты и этапы</h3>
            <div className="flex gap-2 flex-wrap items-center text-sm">
              {useDate ? (
                <label className="text-xs text-muted flex items-center gap-2">
                  Старт
                  <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              ) : (
                <>
                  <span className="text-xs text-muted">Старт: сразу после предыдущего шоу страны{S !== null ? ` (${idxToShort(S)})` : ""}.</span>
                  <button className="text-xs underline text-gold" onClick={() => setUseDate(true)}>
                    Указать дату
                  </button>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              {stages.map((s, i) => {
                const r = S !== null ? stageRange({ ...l, stages }, S, i) : null;
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <input className={`${inp} flex-1`} value={s.name} onChange={(e) => setStages((x) => x.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} />
                    <input type="number" min={1} className={`${inp} w-20`} value={s.days} onChange={(e) => setStages((x) => x.map((y, k) => (k === i ? { ...y, days: Number(e.target.value) } : y)))} />
                    <span className="text-xs text-muted w-24 flex-none">{r ? `${idxToShort(r[0])}–${idxToShort(r[1])}` : "дней"}</span>
                    <button className="text-muted px-1" aria-label="Убрать этап" onClick={() => setStages((x) => x.filter((_, k) => k !== i))}>
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button className={btn} onClick={() => setStages((x) => [...x, { name: "Новый этап", days: 7 }])}>
                ＋ Этап
              </button>
              <button className={btnGold} onClick={saveDates}>
                Сохранить даты
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted">
              Что включено в шоу{blocks.length ? ` · ${onCount} из ${blocks.length}` : ""}
            </h3>
            {blocks.length === 0 && <p className="text-xs text-muted">Блоков пока нет. В старом разделе есть кнопка «Опубликовать шаблон».</p>}
            {Object.entries(groups).map(([g, list]) => (
              <details key={g} className="border border-muted/30 rounded-lg px-3">
                <summary className="cursor-pointer py-2 text-sm text-offwhite">
                  {g} <span className="text-xs text-muted">{list.filter((x) => x.enabled).length} из {list.length}</span>
                </summary>
                <div className="pb-1">
                  {list.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 py-2 border-t border-muted/20">
                      <span className="flex-1 min-w-0 text-sm text-offwhite">{labelOf(b.block_key).replace(/^[^:]+:\s*/, "")}</span>
                      <Toggle on={b.enabled} onChange={(v) => act({ action: "item_save", ...b, enabled: v }, "")} />
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          <details>
            <summary className="cursor-pointer text-sm text-muted">Ещё</summary>
            <div className="flex gap-2 flex-wrap items-end mt-2">
              <button className={btn} onClick={() => onGo?.("builder")}>
                Подсказки, вопросы, задания →
              </button>
              {state !== "draft" && (
                <button className={btn} onClick={() => act({ action: "status", id: l.id, status: "draft" }, "Убрано в черновик.")}>
                  Убрать в черновик
                </button>
              )}
              <label className="text-xs text-muted space-y-1">
                Копировать в другую страну
                <select className={`${inp} block`} value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>
                  <option value="">— страна —</option>
                  {countries
                    .filter((c) => c.id !== cid)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className={btn} disabled={!copyTo} onClick={() => act({ action: "copy", id: l.id, country_id: copyTo }, "Скопировано в «Дальше» выбранной страны (черновиком).")}>
                Копировать
              </button>
              {state !== "live" && (
                <button
                  className="px-3 py-2 rounded-lg border border-red-500/50 text-sm text-red-300"
                  onClick={() => {
                    if (window.confirm("Удалить это шоу и его программу?")) act({ action: "delete", id: l.id }, "Удалено.");
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function country(list: Country[], id: string): Country | undefined {
  return list.find((c) => c.id === id);
}
