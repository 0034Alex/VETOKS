import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const results: {
    title_key: string;
    participant_id: string;
    metric_value: number;
  }[] = [];

  const { data: participants } = await supabase
    .from("participants")
    .select("id, user_id, created_at")
    .eq("is_eliminated", false);

  if (!participants || participants.length === 0) {
    return NextResponse.json({ ok: true, message: "no participants" });
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("participant_id, is_paid, created_at");
  const { data: gifts } = await supabase
    .from("gifts")
    .select("participant_id, quantity");
  const { data: follows } = await supabase
    .from("participant_follows")
    .select("participant_id");
  const { data: messages } = await supabase
    .from("participant_messages")
    .select("participant_id");
  const { data: boosts } = await supabase
    .from("boosts")
    .select("participant_id")
    .eq("boost_type", "rating_bump");
  const { data: taskTx } = await supabase
    .from("wallet_transactions")
    .select("wallet_id, type")
    .eq("type", "task_reward");
  const { data: wallets } = await supabase.from("wallets").select("id, user_id");

  const totalVotes: Record<string, number> = {};
  const todayVotes: Record<string, number> = {};
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  (votes ?? []).forEach((v: { participant_id: string; is_paid: boolean; created_at: string }) => {
    totalVotes[v.participant_id] = (totalVotes[v.participant_id] ?? 0) + 1;
    if (!v.is_paid && new Date(v.created_at) >= startOfDay) {
      todayVotes[v.participant_id] = (todayVotes[v.participant_id] ?? 0) + 1;
    }
  });

  const giftCounts: Record<string, number> = {};
  (gifts ?? []).forEach((g: { participant_id: string; quantity: number }) => {
    giftCounts[g.participant_id] = (giftCounts[g.participant_id] ?? 0) + (g.quantity ?? 1);
  });

  const followCounts: Record<string, number> = {};
  (follows ?? []).forEach((f: { participant_id: string }) => {
    followCounts[f.participant_id] = (followCounts[f.participant_id] ?? 0) + 1;
  });

  const msgCounts: Record<string, number> = {};
  (messages ?? []).forEach((m: { participant_id: string }) => {
    msgCounts[m.participant_id] = (msgCounts[m.participant_id] ?? 0) + 1;
  });

  const boostCounts: Record<string, number> = {};
  (boosts ?? []).forEach((b: { participant_id: string }) => {
    boostCounts[b.participant_id] = (boostCounts[b.participant_id] ?? 0) + 1;
  });

  const walletToUser: Record<string, string> = {};
  (wallets ?? []).forEach((w: { id: string; user_id: string }) => {
    walletToUser[w.id] = w.user_id;
  });
  const userTaskCount: Record<string, number> = {};
  (taskTx ?? []).forEach((t: { wallet_id: string }) => {
    const uid = walletToUser[t.wallet_id];
    if (uid) userTaskCount[uid] = (userTaskCount[uid] ?? 0) + 1;
  });
  const taskCounts: Record<string, number> = {};
  participants.forEach((p) => {
    taskCounts[p.id] = userTaskCount[p.user_id] ?? 0;
  });

  function topBy(map: Record<string, number>, excludeIds: string[] = []) {
    let bestId: string | null = null;
    let bestVal = -1;
    for (const p of participants!) {
      if (excludeIds.includes(p.id)) continue;
      const v = map[p.id] ?? 0;
      if (v > bestVal) {
        bestVal = v;
        bestId = p.id;
      }
    }
    return bestVal > 0 && bestId ? { id: bestId, val: bestVal } : null;
  }

  const missSeason = topBy(totalVotes);
  if (missSeason)
    results.push({
      title_key: "miss_season",
      participant_id: missSeason.id,
      metric_value: missSeason.val,
    });

  const viceMiss = topBy(totalVotes, missSeason ? [missSeason.id] : []);
  if (viceMiss)
    results.push({
      title_key: "vice_miss",
      participant_id: viceMiss.id,
      metric_value: viceMiss.val,
    });

  const audience = topBy(todayVotes);
  if (audience)
    results.push({
      title_key: "audience_choice",
      participant_id: audience.id,
      metric_value: audience.val,
    });

  const giftsQ = topBy(giftCounts);
  if (giftsQ)
    results.push({
      title_key: "gifts_queen",
      participant_id: giftsQ.id,
      metric_value: giftsQ.val,
    });

  const followersQ = topBy(followCounts);
  if (followersQ)
    results.push({
      title_key: "followers_queen",
      participant_id: followersQ.id,
      metric_value: followersQ.val,
    });

  const activityQ = topBy(taskCounts);
  if (activityQ)
    results.push({
      title_key: "activity_queen",
      participant_id: activityQ.id,
      metric_value: activityQ.val,
    });

  const chatQ = topBy(msgCounts);
  if (chatQ)
    results.push({
      title_key: "chat_queen",
      participant_id: chatQ.id,
      metric_value: chatQ.val,
    });

  const boostQ = topBy(boostCounts);
  if (boostQ)
    results.push({
      title_key: "boost_queen",
      participant_id: boostQ.id,
      metric_value: boostQ.val,
    });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const newbies = participants.filter((p) => new Date(p.created_at) >= weekAgo);
  if (newbies.length > 0) {
    let bestId: string | null = null;
    let bestVal = -1;
    newbies.forEach((p) => {
      const v = totalVotes[p.id] ?? 0;
      if (v > bestVal) {
        bestVal = v;
        bestId = p.id;
      }
    });
    if (bestId) {
      results.push({
        title_key: "rookie",
        participant_id: bestId,
        metric_value: bestVal,
      });
    }
  }

  for (const r of results) {
    await supabase.from("title_rankings").upsert(
      {
        title_key: r.title_key,
        participant_id: r.participant_id,
        snapshot_date: today,
        metric_value: r.metric_value,
      },
      { onConflict: "title_key,snapshot_date" }
    );
  }

  // Снимок голосов каждой участницы за сегодня — нужен для стрелочек
  // изменения позиции (↑/↓/NEW) на завтра.
  for (const p of participants) {
    await supabase.from("daily_vote_snapshots").upsert(
      {
        participant_id: p.id,
        snapshot_date: today,
        votes: totalVotes[p.id] ?? 0,
      },
      { onConflict: "participant_id,snapshot_date" }
    );
  }

  return NextResponse.json({ ok: true, count: results.length, date: today });
}
