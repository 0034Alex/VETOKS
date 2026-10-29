"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { BLOCKS, DEFAULT_STAGES, blockFits, dayIdx, effState, idxToStr, itemRange, startIdx, todayIdx, type ItemRow, type LaunchRow } from "@/lib/launch";
import { ItemEditor } from "@/components/AdminLaunchesPanel";
import AdminBetweenPanel from "@/components/AdminBetweenPanel";

const PAGES: [string, string][] = [
  ["home", "Главная"],
  ["people", "Участницы"],
  ["media", "Медиа"],
  ["gifts", "Подарки"],
  ["me", "Профиль"],
];

// Блоки Главной по порядку (как на экране сверху вниз). slot: какой редактор открывается внутри блока.
const HOME: { key: string; slot?: string; note: string }[] = [
  { key: "scope", note: "Две кнопки над лентой: свой регион или вся страна." },
  { key: "cats", note: "Переключатель возрастных категорий." },
  { key: "news", slot: "news", note: "Любое сообщение людям страны: текст, период, возраст, регионы." },
  { key: "strip", slot: "strip", note: "Яркая полоса с обратным отсчётом." },
  { key: "promo", slot: "banners", note: "Загрузить баннер, ссылка, период, регионы." },
  { key: "top", note: "Лучшие участницы по голосам, со ссылкой на полный список." },
  { key: "mag", slot: "magazine", note: "Страницы журнала и реклама в нём." },
  { key: "poll", slot: "poll", note: "Пишите вопросы наперёд и ставьте даты. Люди выбирают участницу, один бесплатный голос на вопрос." },
  { key: "partners", slot: "partners", note: "Логотипы партнёров внизу главной." },
  { key: "apply", note: "Кнопка приёма анкет (для Мисс идёт по статусу сезона)." },
  { key: "battle", note: "Два ролика друг против друга." },
  { key: "stories", note: "Круглые истории сверху." },
];

// Страница «Участницы»: блоки сверху вниз.
const PEOPLE: { key: string; slot?: string; note: string }[] = [
  { key: "p_promo", slot: "banners", note: "Рекламные баннеры над списком: загрузить, ссылка, период, регионы." },
  { key: "p_cats", note: "Переключатель возрастных категорий (только Мисс)." },
  { key: "p_rating", slot: "rating", note: "Вкладка «Рейтинг» рядом со списком: голоса, титулы, движение мест." },
  { key: "p_scope", note: "Две кнопки: свой регион или вся страна." },
  { key: "p_search", note: "Поиск по имени или @нику." },
  { key: "p_filters", note: "Кнопки «Все / Топ / Новые»." },
  { key: "p_blackmark", note: "Кнопка «Чёрная метка» для участницы." },
  { key: "p_ticker", note: "Бегущая лента событий внизу экрана." },
];
// Страница «Медиа» (вертикальная лента роликов).
const MEDIA: { key: string; slot?: string; note: string }[] = [
  { key: "m_recs", slot: "feed", note: "Главная вкладка ленты. Внутри: какие ролики попадают в ленту и как сортируются." },
  { key: "m_following", note: "Ролики тех, на кого подписан человек." },
  { key: "m_country", note: "Ролики по всей стране." },
  { key: "m_live", note: "Вкладка прямых эфиров (только шоу талантов)." },
  { key: "m_search", note: "Поиск по имени участницы." },
  { key: "m_sound", note: "Кнопка включения звука." },
  { key: "m_like", note: "Лайк под роликом." },
  { key: "m_comment", note: "Комментарии под роликом." },
  { key: "m_share", note: "Кнопка «Поделиться»." },
  { key: "m_vote", note: "Кнопка «Голосовать» прямо в ленте." },
];
// Страница «Подарки» (магазин).
const GIFTS: { key: string; slot?: string; note: string }[] = [
  { key: "g_fanzone", note: "Яркая полоса фан-зоны вверху магазина (минимальная сумма задаётся в настройках «Главная»)." },
  { key: "g_gifts", slot: "prices", note: "Вкладка с подарками. Внутри нажмите «Настроить содержимое»: курс доллара, цены подарков, цена буста «Продвинуть в топ», цены голосов, доли участниц." },
  { key: "g_votes", slot: "coins", note: "Вкладка «Голоса». Внутри: монеты, короны и пакеты." },
  { key: "g_cards", slot: "cards", note: "Вкладка «Карточки». Внутри: настройки карточек голосования." },
  { key: "g_topup", note: "Строка с балансом и кнопка «Пополнить»." },
  { key: "g_pick", note: "Выбор, кому подарить: подписки, недавние, поиск." },
  { key: "g_cats", note: "Категории подарков: Лёгкие, Премиум, VIP." },
];
// Страница «Профиль». Кошелёк, «Редактировать», «Настройки» и «Поддержка» есть всегда.
const ME: { key: string; slot?: string; note: string }[] = [
  { key: "r_goal", slot: "goal", note: "Полоса «Цель недели» в кошельке. Внутри: текст цели, сумма, период." },
  { key: "r_ideas", note: "Кнопка «Идеи для контента» (для участниц)." },
  { key: "r_materials", note: "Кнопка «Материалы» (для участниц)." },
  { key: "r_tasks", slot: "tasks", note: "Задания участницы с полоской прогресса. Внутри: список заданий." },
  { key: "r_clan", note: "Чат клана региона." },
  { key: "r_invites", slot: "referrals", note: "Приглашения друзей. Внутри: рефералы и награды." },
  { key: "r_blackmarks", note: "Раздел «Чёрные метки» (для участниц)." },
  { key: "r_docs", note: "Документы (для участниц и партнёров)." },
  { key: "r_partner", note: "Кнопка «Стать партнёром» / «Кабинет партнёра»." },
];
const PAGE_BLOCKS: Record<string, typeof HOME> = { home: HOME, people: PEOPLE, media: MEDIA, gifts: GIFTS, me: ME };

// На главной Мисс слушаются только эти блоки (остальные там пока не выключаются).
const MISS_HOME = ["scope", "cats", "news", "strip", "top", "mag", "poll", "partners"];

export default function AdminShowBuilderPanel({ slots, launchesPanel }: { slots: Record<string, ReactNode>; launchesPanel: ReactNode }) {
  const cid = getCrmCountry();
  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [shows, setShows] = useState<{ key: string; title: string }[]>([]);
  const [lid, setLid] = useState("");
  const [page, setPage] = useState("home");
  const [open, setOpen] = useState<string>("");
  const [newShow, setNewShow] = useState("");
  const [msg, setMsg] = useState("");
  const [wzDate, setWzDate] = useState("");
  const [wzStages, setWzStages] = useState<{ name: string; days: number }[]>(DEFAULT_STAGES.map((s) => ({ ...s })));
  const [wzBusy, setWzBusy] = useState(false);
  const [delAsk, setDelAsk] = useState("");

  async function load() {
    if (!cid) return;
    const r = await apiPost("/api/admin/launches", { action: "list", country_id: cid });
    if (!r?.ok) return setMsg(r?.message || "Не получилось загрузить.");
    const ls: LaunchRow[] = (r.launches ?? []).map((l: LaunchRow) => ({ ...l, stages: Array.isArray(l.stages) ? l.stages : [] }));
    setLaunches(ls);
    setItems(r.items ?? []);
    setShows(r.shows ?? []);
    setNewShow((x) => x || r.shows?.[0]?.key || "");
    setLid((x) => (ls.some((l) => l.id === x) ? x : ls.find((l) => l.status === "live")?.id ?? ls[0]?.id ?? ""));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(body: Record<string, unknown>, ok?: string) {
    const r = await apiPost("/api/admin/launches", body);
    if (!r?.ok) {
      setMsg(r?.message || "Не получилось.");
      return false;
    }
    if (ok) setMsg(ok);
    await load();
    return true;
  }

  async function launchNow() {
    if (wzBusy || !newShow) return;
    setWzBusy(true);
    setMsg("");
    try {
      const a = await apiPost("/api/admin/launches", { action: "create", country_id: cid, show_key: newShow });
      if (!a?.ok) return setMsg(a?.message || "Не получилось создать шоу.");
      const date = wzDate || idxToStr(todayIdx("Europe/Kyiv"));
      const b = await apiPost("/api/admin/launches", { action: "save", id: a.id, start_date: date, stages: wzStages, after_id: "" });
      if (!b?.ok) return setMsg(b?.message || "Шоу создано, но даты не сохранились. Откройте «Даты запуска».");
      const c = await apiPost("/api/admin/launches", { action: "status", id: a.id, status: "live" });
      setMsg(c?.ok ? "Готово: шоу запущено." : `Шоу создано как черновик. ${c?.message || ""}`);
      await load();
      setLid(a.id);
    } finally {
      setWzBusy(false);
    }
  }
  if (!cid) return <p className="text-muted text-sm">Выберите страну вверху CRM.</p>;
  const title = (k: string) => shows.find((s) => s.key === k)?.title || k;
  const l = launches.find((x) => x.id === lid) ?? null;
  const S = l ? startIdx(l, launches) : null;
  const eff = l ? effState(l, launches, todayIdx(l.tz)) : null;
  const mine = items.filter((i) => i.launch_id === lid && i.kind === "block");
  function homeList(l: LaunchRow) {
    const base = (PAGE_BLOCKS[page] ?? []).filter((h) => blockFits(h.key, l.show_key) && (page !== "home" || l.show_key !== "miss" || MISS_HOME.includes(h.key)));
    if (l.show_key === "miss" && page === "home") return base;
    const pos = (k: string) => mine.find((i) => i.block_key === k)?.sort ?? 1e6;
    return base.map((h, i) => ({ h, i })).sort((a, b) => pos(a.h.key) - pos(b.h.key) || a.i - b.i).map((x) => x.h);
  }
  async function move(l: LaunchRow, arr: { key: string }[], hi: number, dir: number) {
    const keys = arr.map((h) => h.key);
    const j = hi + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[hi], keys[j]] = [keys[j], keys[hi]];
    let n = 0;
    for (const k of keys) {
      const it = mine.find((i) => i.block_key === k);
      if (!it) continue;
      n += 10;
      if (it.sort !== n) await act({ action: "item_save", id: it.id, launch_id: l.id, kind: "block", block_key: k, title: it.title, body: it.body, enabled: it.enabled, stage: it.stage, start_mode: it.start_mode, start_n: it.start_n, dur_mode: it.dur_mode, dur_n: it.dur_n, sort: n });
    }
  }
  const input = "w-full bg-bgPrimary border border-muted/60 rounded-lg px-2.5 py-2 text-sm text-offwhite";

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-bgSurface border border-muted/40 rounded-xl p-3">
        <button className="w-full text-left text-sm font-semibold text-offwhite flex justify-between" onClick={() => setOpen(open === "__between" ? "" : "__between")}>
          Страница «Между шоу»: что видят люди, когда шоу не идёт <span className="text-gold">{open === "__between" ? "▲" : "▼"}</span>
        </button>
        {open === "__between" && <div className="pt-3"><AdminBetweenPanel /></div>}
      </div>
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 space-y-3">
        <p className="text-offwhite font-semibold text-sm">Конструктор шоу</p>
        <p className="text-muted text-xs">Страна выбирается вверху CRM. Здесь шоу этой страны и все страницы приложения: включайте блоки, задавайте, когда они показываются, и сразу меняйте их содержимое.</p>
        {launches.length > 0 && (
          <label className="text-[11px] text-muted block space-y-1">
            Шоу в стране
            <select className={input} value={lid} onChange={(e) => { setLid(e.target.value); setOpen(""); }}>
              {launches.map((x) => (
                <option key={x.id} value={x.id}>
                  {title(x.show_key)}
                </option>
              ))}
            </select>
          </label>
        )}
        {l && eff && <p className="text-xs text-gold">Сейчас: {({ draft: "черновик", waiting: "запланировано", live: "идёт", paused: "на паузе", finished: "закончено" } as Record<string, string>)[eff.state] ?? eff.state}{S !== null ? "" : " · дата старта не задана"}</p>}
        <div className="border border-gold/40 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-offwhite">Запустить шоу в этой стране</p>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="text-[11px] text-muted space-y-1 flex-1 min-w-[150px]">
              Шоу
              <select className={input} value={newShow} onChange={(e) => setNewShow(e.target.value)}>
                {shows.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-muted space-y-1 flex-1 min-w-[150px]">
              Дата старта
              <input type="date" className={input} value={wzDate} onChange={(e) => setWzDate(e.target.value)} />
            </label>
          </div>
          <p className="text-[11px] text-muted">Этапы и сколько дней идёт каждый:</p>
          <div className="space-y-1.5">
            {wzStages.map((st, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={input} value={st.name} onChange={(e) => setWzStages(wzStages.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <input type="number" min={1} max={365} className={`${input} !w-20`} value={st.days} onChange={(e) => setWzStages(wzStages.map((x, k) => (k === i ? { ...x, days: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                <span className="text-[11px] text-muted">дн.</span>
                {wzStages.length > 1 && (
                  <button className="text-red-300 text-sm px-1" onClick={() => setWzStages(wzStages.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button className="text-sm text-gold" onClick={() => setWzStages([...wzStages, { name: "Этап", days: 7 }])}>
              + Этап
            </button>
          </div>
          <button disabled={wzBusy} className="w-full px-3 py-2.5 rounded-lg bg-gold text-black text-sm font-semibold disabled:opacity-50" onClick={launchNow}>
            {wzBusy ? "Запускаю..." : "Запустить шоу"}
          </button>
          <p className="text-[11px] text-muted">Дата в будущем: шоу само включится в этот день. Пусто: стартует сегодня.</p>
        </div>
        {launches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted">Шоу этой страны</p>
            {launches.map((x) => (
              <div key={x.id} className={`flex items-center gap-2 border rounded-lg px-2.5 py-2 ${x.id === lid ? "border-gold/60" : "border-muted/40"}`}>
                <button className="flex-1 text-left text-sm text-offwhite min-w-0 truncate" onClick={() => { setLid(x.id); setOpen(""); }}>
                  {title(x.show_key)}
                </button>
                <span className="text-[11px] text-muted">{({ draft: "черновик", live: "идёт", paused: "пауза", finished: "закончено" } as Record<string, string>)[x.status] ?? x.status}</span>
                {delAsk === x.id ? (
                  <>
                    <button className="text-xs text-red-300 border border-red-300/60 rounded px-2 py-1" onClick={async () => { setDelAsk(""); await act({ action: "delete", id: x.id }, "Удалено."); }}>
                      Точно удалить
                    </button>
                    <button className="text-xs text-muted" onClick={() => setDelAsk("")}>
                      Отмена
                    </button>
                  </>
                ) : (
                  <button className="text-xs text-red-300" onClick={() => setDelAsk(x.id)}>
                    Удалить
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {msg && <p className="text-sm text-gold">{msg}</p>}
      </div>

      {l && (
        <>
          <details className="bg-bgSurface border border-muted/40 rounded-xl p-3">
            <summary className="cursor-pointer text-sm font-semibold text-offwhite">Даты запуска, этапы, старт и пауза</summary>
            <div className="pt-3">{launchesPanel}</div>
          </details>

          <div className="flex gap-2 flex-wrap">
            {PAGES.map(([k, label]) => (
              <button key={k} onClick={() => { setPage(k); setOpen(""); }} className={`px-4 py-2 rounded-full text-sm ${page === k ? "bg-gold text-black font-semibold" : "bg-bgSurface border border-muted/50 text-muted"}`}>
                {label}
              </button>
            ))}
          </div>

          {PAGE_BLOCKS[page] ? (
            <div className="space-y-3">
              {page === "home" && l.show_key === "miss" && (
                <div className="bg-bgSurface border border-muted/40 rounded-xl p-3">
                  <button className="w-full text-left text-sm font-semibold text-offwhite flex justify-between" onClick={() => setOpen(open === "__stages" ? "" : "__stages")}>
                    Шапка этапа: этапы сезона, обложки, вопрос опроса <span className="text-gold">{open === "__stages" ? "▲" : "▼"}</span>
                  </button>
                  {open === "__stages" && <div className="pt-3">{slots.stages}</div>}
                </div>
              )}
              {homeList(l).map((h, hi, arr) => {
                const it = mine.find((i) => i.block_key === h.key);
                const def = BLOCKS.find((b) => b.key === h.key)!;
                const slot = h.slot === "poll" ? <PollQuestions launch={l} S={S} items={items.filter((i) => i.launch_id === l.id && i.kind === "question")} act={act} fallback={slots.stages} /> : h.slot ? slots[h.slot] : null;
                return (
                  <div key={h.key} className="space-y-2">
                    {it && !(l.show_key === "miss" && page === "home") && (
                      <div className="flex gap-1 justify-end">
                        <button disabled={hi === 0 || !arr[hi - 1] || !mine.find((i) => i.block_key === arr[hi - 1].key)} className="px-3 py-1.5 rounded-lg border border-muted/60 text-sm text-offwhite disabled:opacity-30" onClick={() => move(l, arr, hi, -1)}>▲ Выше</button>
                        <button disabled={hi === arr.length - 1 || !mine.find((i) => i.block_key === arr[hi + 1]?.key)} className="px-3 py-1.5 rounded-lg border border-muted/60 text-sm text-offwhite disabled:opacity-30" onClick={() => move(l, arr, hi, 1)}>▼ Ниже</button>
                      </div>
                    )}
                    {it ? (
                      <ItemEditor key={it.id + "-" + it.start_mode + it.stage + it.enabled} launch={l} S={S} it={it} act={act} />
                    ) : (
                      <div className="border border-dashed border-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                        <span className="flex-1 text-sm text-offwhite">{def.label}</span>
                        <button className="px-3 py-2 rounded-lg border border-muted/60 text-sm text-offwhite" onClick={() => act({ action: "item_save", launch_id: l.id, kind: "block", block_key: h.key, stage: def.stage, enabled: true, start_mode: def.start_mode, start_n: def.start_n, dur_mode: def.dur_mode, dur_n: def.dur_n, sort: 20 }, "Блок добавлен.")}>
                          Добавить блок
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-muted px-1">{h.note}</p>
                    {slot && (
                      <div className="px-1">
                        <button className="text-sm text-gold" onClick={() => setOpen(open === h.key ? "" : h.key)}>
                          {open === h.key ? "▲ Скрыть настройки содержимого" : "▼ Настроить содержимое"}
                        </button>
                        {open === h.key && <div className="mt-2 border border-muted/40 rounded-xl p-3">{slot}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-bgSurface border border-muted/40 rounded-xl p-4 text-sm text-muted">
              Страница «{PAGES.find((p) => p[0] === page)?.[1]}» переедет в конструктор следующим шагом. Пока её настройки лежат в старых разделах CRM.
            </div>
          )}
        </>
      )}
      {!l && launches.length === 0 && <p className="text-sm text-muted">В этой стране пока нет шоу. Добавьте шоу выше, и появятся страницы.</p>}
    </div>
  );
}


// Вопросы опроса: текст и даты «с» и «по». Даты считаются от старта запуска.
function PollQuestions({ launch, S, items, act, fallback }: { launch: LaunchRow; S: number | null; items: ItemRow[]; act: (b: Record<string, unknown>, ok?: string) => Promise<boolean>; fallback: ReactNode }) {
  const [showFallback, setShowFallback] = useState(false);
  const inp = "w-full bg-bgPrimary border border-muted/60 rounded-lg px-2.5 py-2 text-base text-offwhite min-w-0";
  if (S === null) return <p className="text-sm text-muted">Сначала задайте дату старта шоу (блок «Даты запуска» выше), тогда можно ставить даты вопросам.</p>;
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-xs text-muted">Вопросов пока нет.</p>}
      {items.map((it) => (
        <QuestionRow key={it.id + "-" + it.start_n + it.dur_n + it.body} launch={launch} S={S} it={it} act={act} inp={inp} />
      ))}
      <button
        className="px-3 py-2 rounded-lg border border-muted/60 text-sm text-offwhite"
        onClick={() => act({ action: "item_save", launch_id: launch.id, kind: "question", title: "", body: "", stage: -1, enabled: true, start_mode: "from", start_n: Math.max(0, todayIdx(launch.tz) - S), dur_mode: "days", dur_n: 7, sort: 10 + items.length }, "Вопрос добавлен: напишите текст и нажмите «Сохранить».")}
      >
        + Вопрос
      </button>
      <p className="text-[11px] text-muted">На главной показывается вопрос, у которого сегодня идут даты. Если на сегодня вопроса нет, показывается вопрос этапа (как раньше).</p>
      <button className="text-sm text-gold" onClick={() => setShowFallback(!showFallback)}>
        {showFallback ? "▲ Скрыть вопросы этапов" : "▼ Вопросы этапов (запасные)"}
      </button>
      {showFallback && <div className="border border-muted/40 rounded-xl p-3">{fallback}</div>}
    </div>
  );
}

function QuestionRow({ launch, S, it, act, inp }: { launch: LaunchRow; S: number; it: ItemRow; act: (b: Record<string, unknown>, ok?: string) => Promise<boolean>; inp: string }) {
  const r = itemRange(launch, S, it);
  const [text, setText] = useState(it.body || it.title || "");
  const [from, setFrom] = useState(r ? idxToStr(r[0]) : "");
  const [to, setTo] = useState(r ? idxToStr(r[1]) : "");
  const [on, setOn] = useState(it.enabled);
  const dirty = text !== (it.body || it.title || "") || (r && (from !== idxToStr(r[0]) || to !== idxToStr(r[1]))) || on !== it.enabled;
  function save() {
    if (!from || !to || dayIdx(to) < dayIdx(from)) return;
    act(
      { action: "item_save", id: it.id, launch_id: launch.id, kind: "question", title: "", body: text.slice(0, 200), stage: -1, enabled: on, start_mode: "from", start_n: Math.max(0, dayIdx(from) - S), dur_mode: "days", dur_n: dayIdx(to) - dayIdx(from) + 1, sort: it.sort },
      "Сохранено."
    );
  }
  return (
    <div className={`border border-muted/40 rounded-xl p-2.5 space-y-2 ${on ? "" : "opacity-60"}`}>
      <textarea className={`${inp} min-h-[56px]`} placeholder="Вопрос зрителям, например: Кто лучше выступила на этой неделе?" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2 flex-wrap items-end">
        <label className="text-[11px] text-muted flex-1 min-w-[130px] space-y-1">
          С
          <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-[11px] text-muted flex-1 min-w-[130px] space-y-1">
          По (включая)
          <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-xs text-offwhite flex items-center gap-1.5 pb-2">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Включён
        </label>
      </div>
      <div className="flex gap-2 items-center">
        {dirty && (
          <button className="px-3 py-2 rounded-lg bg-gold text-black text-sm font-semibold" onClick={save}>
            Сохранить
          </button>
        )}
        <button className="text-xs text-red-300 ml-auto" onClick={() => act({ action: "item_delete", id: it.id }, "Удалено.")}>
          Удалить
        </button>
      </div>
    </div>
  );
}
