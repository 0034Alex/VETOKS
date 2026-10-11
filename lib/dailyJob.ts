import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addDays, kyivDate, kyivDayStartUtc, kyivWeekStart } from "@/lib/kyiv";

// Ежедневный пересчёт (запускается в 00:01 по Киеву):
//  1) штраф за чёрные метки прошедшей недели (раз в неделю),
//  2) титулы по каждому региону и по стране,
//  3) Топ-25 за прошедшие сутки,
//  4) снимок голосов для стрелочек ↑/↓.
// Запускать можно сколько угодно раз — результат за дату перезаписывается.

type P = { id: string; user_id: string; region_id: string | null; created_at: string };
type Setting = { key: string; label: string; unit: string; metric: string; enabled: boolean; sort_order: number };

async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; from < 200000; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < page) break;
  }
  return out;
}

async function rpcMap(fn: string, args?: object): Promise<Record<string, number>> {
  const rows = await selectAll<{ participant_id: string; cnt: number }>((a, b) =>
    supabaseAdmin.rpc(fn, args as any).range(a, b) as any
  );
  const m: Record<string, number> = {};
  rows.forEach((r) => (m[r.participant_id] = Number(r.cnt)));
  return m;
}

function countBy<T>(rows: T[], key: (r: T) => string | undefined, weight?: (r: T) => number) {
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const k = key(r);
    if (!k) return;
    m[k] = (m[k] ?? 0) + (weight ? weight(r) : 1);
  });
  return m;
}

async function setting(key: string, fallback: number): Promise<number> {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value);
  return data?.value !== undefined && data?.value !== "" && Number.isFinite(n) ? n : fallback;
}

// ---------- чёрные метки ----------
async function applyBlackMarkPenalties(totals: Record<string, number>) {
  const weekStart = addDays(kyivWeekStart(), -7); // последняя закончившаяся неделя
  const pct = await setting("black_mark_penalty_percent", 10);
  const minMarks = await setting("black_mark_min_marks", 2);

  const marks = await selectAll<{ target_participant_id: string; region_id: string }>((a, b) =>
    supabaseAdmin
      .from("black_marks")
      .select("target_participant_id, region_id")
      .eq("week_start", weekStart)
      .range(a, b) as any
  );
  const { data: done } = await supabaseAdmin
    .from("black_mark_penalties")
    .select("region_id")
    .eq("week_start", weekStart);
  const doneRegions = new Set((done ?? []).map((d: any) => d.region_id));

  const byRegion: Record<string, Record<string, number>> = {};
  marks.forEach((m) => {
    byRegion[m.region_id] ??= {};
    byRegion[m.region_id][m.target_participant_id] =
      (byRegion[m.region_id][m.target_participant_id] ?? 0) + 1;
  });

  let applied = 0;
  for (const regionId of Object.keys(byRegion)) {
    if (doneRegions.has(regionId)) continue;
    const counts = byRegion[regionId];
    // Больше всего меток; при равенстве — у кого больше голосов.
    const ids = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a] || (totals[b] ?? 0) - (totals[a] ?? 0)
    );
    const top = ids[0];
    if (!top || counts[top] < minMarks) continue;

    const before = totals[top] ?? 0;
    const penalty = Math.round((before * pct) / 100);
    const { error } = await supabaseAdmin.from("black_mark_penalties").insert({
      participant_id: top,
      region_id: regionId,
      week_start: weekStart,
      marks_count: counts[top],
      votes_before: before,
      penalty_votes: penalty,
    });
    if (!error) {
      totals[top] = Math.max(0, before - penalty);
      applied++;
    }
  }
  return applied;
}

// ---------- титулы ----------
function pickTop(
  list: P[],
  metric: Record<string, number>,
  totals: Record<string, number>,
  skip = 0
): { id: string; val: number } | null {
  const sorted = [...list].sort(
    (a, b) =>
      (metric[b.id] ?? 0) - (metric[a.id] ?? 0) ||
      (totals[b.id] ?? 0) - (totals[a.id] ?? 0) ||
      a.created_at.localeCompare(b.created_at)
  );
  const p = sorted[skip];
  if (!p) return null;
  const val = metric[p.id] ?? 0;
  return val > 0 ? { id: p.id, val } : null;
}

export async function runDailyJob() {
  const today = kyivDate();
  const dayFrom = kyivDayStartUtc(addDays(today, -1)).toISOString();
  const dayTo = kyivDayStartUtc(today).toISOString();

  const participants = await selectAll<P>((a, b) =>
    supabaseAdmin
      .from("participants")
      .select("id, user_id, region_id, created_at")
      .eq("is_eliminated", false)
      .range(a, b) as any
  );

  // 1) голоса и штраф
  const totals = await rpcMap("vt_vote_totals");
  const penaltiesApplied = await applyBlackMarkPenalties(totals);

  // 2) метрики
  const dayVotes = await rpcMap("vt_free_votes_between", { p_from: dayFrom, p_to: dayTo });
  const gifts = await rpcMap("get_participant_gift_counts");
  const followers = await rpcMap("get_participant_follower_counts");

  const msgRows = await selectAll<{ participant_id: string }>((a, b) =>
    supabaseAdmin.from("participant_messages").select("participant_id").range(a, b) as any
  );
  const messages = countBy(msgRows, (r) => r.participant_id);

  const boostRows = await selectAll<{ participant_id: string }>((a, b) =>
    supabaseAdmin
      .from("boosts")
      .select("participant_id")
      .eq("boost_type", "rating_bump")
      .range(a, b) as any
  );
  const boosts = countBy(boostRows, (r) => r.participant_id);

  const taskTx = await selectAll<{ wallet_id: string }>((a, b) =>
    supabaseAdmin
      .from("wallet_transactions")
      .select("wallet_id")
      .eq("type", "task_reward")
      .range(a, b) as any
  );
  const walletRows = await selectAll<{ id: string; user_id: string }>((a, b) =>
    supabaseAdmin.from("wallets").select("id, user_id").range(a, b) as any
  );
  const walletUser: Record<string, string> = {};
  walletRows.forEach((w) => (walletUser[w.id] = w.user_id));
  const userTasks = countBy(taskTx, (t) => walletUser[t.wallet_id]);
  const tasks: Record<string, number> = {};
  participants.forEach((p) => (tasks[p.id] = userTasks[p.user_id] ?? 0));

  // 3) титулы
  const { data: settingsData } = await supabaseAdmin
    .from("title_settings")
    .select("key, label, unit, metric, enabled, sort_order")
    .eq("enabled", true);
  const titles = (settingsData ?? []) as Setting[];

  const weekAgo = Date.now() - 7 * 86400000;

  function compute(list: P[]) {
    const out: { title_key: string; participant_id: string; metric_value: number }[] = [];
    for (const t of titles) {
      let r: { id: string; val: number } | null = null;
      switch (t.metric) {
        case "total_votes": r = pickTop(list, totals, totals, 0); break;
        case "second_votes": r = pickTop(list, totals, totals, 1); break;
        case "day_votes": r = pickTop(list, dayVotes, totals); break;
        case "gifts": r = pickTop(list, gifts, totals); break;
        case "followers": r = pickTop(list, followers, totals); break;
        case "tasks": r = pickTop(list, tasks, totals); break;
        case "messages": r = pickTop(list, messages, totals); break;
        case "boosts": r = pickTop(list, boosts, totals); break;
        case "rookie_votes":
          r = pickTop(list.filter((p) => new Date(p.created_at).getTime() >= weekAgo), totals, totals);
          break;
      }
      if (r) out.push({ title_key: t.key, participant_id: r.id, metric_value: r.val });
    }
    return out;
  }

  const rows: any[] = [];
  compute(participants).forEach((r) =>
    rows.push({ snapshot_date: today, scope: "country", region_id: null, ...r })
  );
  const regionIds = [...new Set(participants.map((p) => p.region_id).filter(Boolean))] as string[];
  for (const rid of regionIds) {
    compute(participants.filter((p) => p.region_id === rid)).forEach((r) =>
      rows.push({ snapshot_date: today, scope: "region", region_id: rid, ...r })
    );
  }
  await supabaseAdmin.from("title_rankings_v2").delete().eq("snapshot_date", today);
  for (let i = 0; i < rows.length; i += 500) {
    await supabaseAdmin.from("title_rankings_v2").insert(rows.slice(i, i + 500));
  }

  // 4) Топ-25 за прошедшие сутки (бесплатные голоса)
  const top = [...participants]
    .filter((p) => (dayVotes[p.id] ?? 0) > 0)
    .sort((a, b) => (dayVotes[b.id] ?? 0) - (dayVotes[a.id] ?? 0) || (totals[b.id] ?? 0) - (totals[a.id] ?? 0))
    .slice(0, 25)
    .map((p, i) => ({ snapshot_date: today, rank: i + 1, participant_id: p.id, votes: dayVotes[p.id] }));
  await supabaseAdmin.from("top25_daily").delete().eq("snapshot_date", today);
  if (top.length) await supabaseAdmin.from("top25_daily").insert(top);

  // 5) снимок для стрелочек
  const snaps = participants.map((p) => ({
    participant_id: p.id,
    snapshot_date: today,
    votes: totals[p.id] ?? 0,
  }));
  for (let i = 0; i < snaps.length; i += 500) {
    await supabaseAdmin
      .from("daily_vote_snapshots")
      .upsert(snaps.slice(i, i + 500), { onConflict: "participant_id,snapshot_date" });
  }

  const summary = {
    date: today,
    participants: participants.length,
    titles: rows.length,
    top25: top.length,
    penalties: penaltiesApplied,
    at: new Date().toISOString(),
  };
  await supabaseAdmin
    .from("platform_settings")
    .upsert({ key: "last_daily_run", value: JSON.stringify(summary) });
  return summary;
}
