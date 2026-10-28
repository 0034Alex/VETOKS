import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { activeItems, effState, stageAt, totalDays, type ItemRow, type LaunchRow } from "@/lib/launch";

// Что видит человек из страны, где есть запуски. null — в стране запусков нет,
// приложение работает как раньше (по датам в разделе «Шоу»).
export type CountryView = {
  liveKey: string | null;
  recruitKey: string | null;
  blocks: string[] | null; // какие блоки включены сегодня (null — все)
  banner: { apply?: boolean; poll_question?: string };
  info: { stage: string; day: number; total: number; tips: string[]; tasks: string[] } | null;
};

export async function loadCountryLaunches(countryId: string): Promise<{ launches: LaunchRow[]; items: ItemRow[] }> {
  const { data: ls } = await supabaseAdmin.from("launches").select("*").eq("country_id", countryId).order("position", { ascending: true });
  const launches = ((ls as LaunchRow[]) ?? []).map((l) => ({ ...l, stages: Array.isArray(l.stages) ? l.stages : [] }));
  if (!launches.length) return { launches, items: [] };
  const { data: it } = await supabaseAdmin.from("launch_items").select("*").in("launch_id", launches.map((l) => l.id)).order("sort", { ascending: true });
  return { launches, items: (it as ItemRow[]) ?? [] };
}

export async function countryView(countryId: string, now: number = Date.now()): Promise<CountryView | null> {
  const { launches, items } = await loadCountryLaunches(countryId);
  if (!launches.length) return null;
  const view: CountryView = { liveKey: null, recruitKey: null, blocks: null, banner: {}, info: null };

  const states = launches.map((l) => ({ l, ...effState(l, launches, todayIdxOf(l, now)) }));
  const live = states.filter((s) => s.state === "live").sort((a, b) => (a.S ?? 0) - (b.S ?? 0))[0];
  if (live && live.S !== null) {
    const today = todayIdxOf(live.l, now);
    const mine = items.filter((i) => i.launch_id === live.l.id);
    const act = activeItems(live.l, mine, live.S, today);
    view.liveKey = live.l.show_key;
    const blockItems = mine.filter((i) => i.kind === "block");
    if (blockItems.length) view.blocks = act.filter((i) => i.kind === "block" && i.block_key).map((i) => i.block_key as string);
    if (blockItems.some((i) => i.block_key === "apply")) view.banner.apply = !!view.blocks?.includes("apply");
    const q = act.find((i) => i.kind === "question");
    if (q) view.banner.poll_question = (q.body || q.title).slice(0, 200);
    const st = stageAt(live.l, live.S, today);
    view.info = {
      stage: st?.name ?? "",
      day: st?.day ?? 1,
      total: totalDays(live.l),
      tips: act.filter((i) => i.kind === "tip").map((i) => (i.body || i.title).slice(0, 400)),
      tasks: act.filter((i) => i.kind === "task").map((i) => (i.body || i.title).slice(0, 400)),
    };
  }
  // Набор анкет на следующее шоу: запуск ещё не начался, а кнопка «Подать анкету» уже действует.
  const rec = states.find((s) => {
    if (s.state !== "waiting" || s.S === null || s.l.id === live?.l.id) return false;
    const act = activeItems(s.l, items.filter((i) => i.launch_id === s.l.id), s.S, todayIdxOf(s.l, now));
    return act.some((i) => i.kind === "block" && i.block_key === "apply");
  });
  if (rec) view.recruitKey = rec.l.show_key;
  return view;
}

import { todayIdx } from "@/lib/launch";
function todayIdxOf(l: LaunchRow, now: number) {
  return todayIdx(l.tz, now);
}
