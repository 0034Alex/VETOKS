import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { kyivWeekStart } from "@/lib/kyiv";
import { rateHit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Данные для окна «Чёрная метка» и страницы меток. Кто кому отправил — знает только сервер,
// участницам отдаём лишь итоговые числа.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateHit(`bminfo:${uid}`, 60, 60);
  if (!rl.ok) return bad("rate_limited", 429);

  const weekStart = kyivWeekStart();
  const { data: me } = await supabaseAdmin
    .from("participants")
    .select("id, region_id")
    .eq("user_id", uid)
    .maybeSingle();
  if (!me) return NextResponse.json({ ok: true, participant: false });

  const { data: sent } = await supabaseAdmin
    .from("black_marks")
    .select("target_participant_id")
    .eq("sender_participant_id", me.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  const { count: myCount } = await supabaseAdmin
    .from("black_marks")
    .select("id", { count: "exact", head: true })
    .eq("target_participant_id", me.id)
    .eq("week_start", weekStart);

  const { data: pen } = await supabaseAdmin
    .from("black_mark_penalties")
    .select("penalty_votes, week_start")
    .eq("participant_id", me.id)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  let leader: { id: string; display_name: string; photo_url: string | null; count: number } | null = null;
  let leaderPenalty: number | null = null;
  if (me.region_id) {
    const { data: marks } = await supabaseAdmin
      .from("black_marks")
      .select("target_participant_id")
      .eq("region_id", me.region_id)
      .eq("week_start", weekStart);
    const counts: Record<string, number> = {};
    (marks ?? []).forEach((m: any) => {
      counts[m.target_participant_id] = (counts[m.target_participant_id] ?? 0) + 1;
    });
    const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (topId) {
      const { data: tp } = await supabaseAdmin
        .from("participants")
        .select("id, display_name, photo_url")
        .eq("id", topId)
        .maybeSingle();
      if (tp) leader = { ...(tp as any), count: counts[topId] };
      const { data: lp } = await supabaseAdmin
        .from("black_mark_penalties")
        .select("penalty_votes")
        .eq("participant_id", topId)
        .eq("week_start", weekStart)
        .maybeSingle();
      leaderPenalty = (lp as any)?.penalty_votes ?? null;
    }
  }

  return NextResponse.json({
    ok: true,
    participant: true,
    sentTo: sent?.target_participant_id ?? null,
    myCount: myCount ?? 0,
    myPenalty: (pen as any)?.penalty_votes ?? null,
    leader,
    leaderPenalty,
  });
}
