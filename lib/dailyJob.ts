import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addDays, kyivDate, kyivDayStartUtc, kyivWeekStart } from "@/lib/kyiv";
import { notify } from "@/lib/shopServer";
import { pickText } from "@/lib/pushText";

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

// ---------- «вы поднялись / потеряли место» ----------
// Сравниваем место в регионе по снимку голосов за прошлый запуск и по текущим голосам.
async function notifyRankChanges(participants: P[], totals: Record<string, number>, today: string) {
  const { data: flag } = await supabaseAdmin.from("platform_settings").select("value").eq("key", "rank_notified_date").maybeSingle();
  if (flag?.value === today) return 0; // сегодня уже отправляли (повторный запуск расчёта)

  const { data: d } = await supabaseAdmin
    .from("daily_vote_snapshots")
    .select("snapshot_date")
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const prevDate = d?.[0]?.snapshot_date as string | undefined;
  if (!prevDate) return 0;

  const prevRows = await selectAll<{ participant_id: string; votes: number }>((a, b) =>
    supabaseAdmin.from("daily_vote_snapshots").select("participant_id, votes").eq("snapshot_date", prevDate).range(a, b) as any
  );
  const prev: Record<string, number> = {};
  prevRows.forEach((r) => (prev[r.participant_id] = Number(r.votes)));

  const byRegion: Record<string, P[]> = {};
  participants.forEach((p) => {
    if (p.region_id) (byRegion[p.region_id] ??= []).push(p);
  });

  let sent = 0;
  for (const list of Object.values(byRegion)) {
    const withPrev = list.filter((p) => prev[p.id] !== undefined);
    if (withPrev.length < 2) continue;
    const rankOf = (votes: (id: string) => number) => {
      const sorted = [...withPrev].sort((a, b) => votes(b.id) - votes(a.id) || a.created_at.localeCompare(b.created_at));
      const m: Record<string, number> = {};
      sorted.forEach((p, i) => (m[p.id] = i + 1));
      return m;
    };
    const before = rankOf((id) => prev[id] ?? 0);
    const after = rankOf((id) => totals[id] ?? 0);
    for (const p of withPrev) {
      const o = before[p.id], n = after[p.id];
      if (n === o || sent >= 3000) continue;
      const link = `/participant/${p.id}`;
      if (n > o) {
        const text = await pickText(p.user_id, {
          ru: `📉 Вы потеряли место: было №${o}, стало №${n}. Позовите друзей голосовать — вернитесь наверх!`,
          uk: `📉 Ви втратили місце: було №${o}, стало №${n}. Покличте друзів голосувати — поверніться нагору!`,
          en: `📉 You dropped from #${o} to #${n}. Invite friends to vote and climb back up!`,
        });
        await notify(p.user_id, text, link, "rating");
      } else {
        const text = await pickText(p.user_id, {
          ru: `🚀 Вы поднялись: было №${o}, стало №${n}. Так держать!`,
          uk: `🚀 Ви піднялися: було №${o}, стало №${n}. Так тримати!`,
          en: `🚀 You moved up from #${o} to #${n}. Keep it up!`,
        });
        await notify(p.user_id, text, link, "rating");
      }
      sent++;
    }
  }
  await supabaseAdmin.from("platform_settings").upsert({ key: "rank_notified_date", value: today });
  return sent;
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

  // Каждая страна считается отдельно: рейтинги и топ не смешиваются.
  const { data: regRows } = await supabaseAdmin.from("regions").select("id, country_id");
  const regionCountry: Record<string, string> = {};
  (regRows ?? []).forEach((r: any) => {
    if (r.country_id) regionCountry[r.id] = r.country_id;
  });
  const countryOf = (p: P) => (p.region_id ? regionCountry[p.region_id] ?? null : null);
  const countryIds = [...new Set(participants.map(countryOf).filter(Boolean))] as string[];

  const rows: any[] = [];
  for (const cid of countryIds) {
    compute(participants.filter((p) => countryOf(p) === cid)).forEach((r) =>
      rows.push({ snapshot_date: today, scope: "country", region_id: null, country_id: cid, ...r })
    );
  }
  const regionIds = [...new Set(participants.map((p) => p.region_id).filter(Boolean))] as string[];
  for (const rid of regionIds) {
    compute(participants.filter((p) => p.region_id === rid)).forEach((r) =>
      rows.push({ snapshot_date: today, scope: "region", region_id: rid, country_id: regionCountry[rid] ?? null, ...r })
    );
  }
  await supabaseAdmin.from("title_rankings_v2").delete().eq("snapshot_date", today);
  for (let i = 0; i < rows.length; i += 500) {
    await supabaseAdmin.from("title_rankings_v2").insert(rows.slice(i, i + 500));
  }

  // 4) Топ-25 за прошедшие сутки (бесплатные голоса)
  const top: { snapshot_date: string; rank: number; participant_id: string; votes: number; country_id: string }[] = [];
  for (const cid of countryIds) {
    [...participants]
      .filter((p) => countryOf(p) === cid && (dayVotes[p.id] ?? 0) > 0)
      .sort((a, b) => (dayVotes[b.id] ?? 0) - (dayVotes[a.id] ?? 0) || (totals[b.id] ?? 0) - (totals[a.id] ?? 0))
      .slice(0, 25)
      .forEach((p, i) =>
        top.push({ snapshot_date: today, rank: i + 1, participant_id: p.id, votes: dayVotes[p.id], country_id: cid })
      );
  }
  await supabaseAdmin.from("top25_daily").delete().eq("snapshot_date", today);
  if (top.length) await supabaseAdmin.from("top25_daily").insert(top);

  // Сообщения о смене места (приложение + бот). Ошибки не должны ломать расчёт.
  let rankPushes = 0;
  try {
    rankPushes = await notifyRankChanges(participants, totals, today);
  } catch {
    rankPushes = 0;
  }

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
    rank_pushes: rankPushes,
    at: new Date().toISOString(),
  };
  await supabaseAdmin
    .from("platform_settings")
    .upsert({ key: "last_daily_run", value: JSON.stringify(summary) });
  return summary;
}
