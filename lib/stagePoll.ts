import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PollStage = { id: string; stage_number: number; title: string; question: string };

// Текущий этап страны (как на главной): самый свежий сезон страны,
// первый этап с датой окончания в будущем, иначе без даты, иначе первый.
export async function currentStageOfCountry(countryId: string | null): Promise<PollStage | null> {
  let sq = supabaseAdmin.from("seasons").select("id").order("created_at", { ascending: false }).limit(1);
  if (countryId) sq = sq.eq("country_id", countryId);
  const { data: season } = await sq.maybeSingle();
  if (!season) return null;
  const { data: stages } = await supabaseAdmin
    .from("season_stages")
    .select("id, stage_number, title, ends_at, poll_question")
    .eq("season_id", (season as any).id)
    .order("stage_number", { ascending: true });
  const list = (stages ?? []) as any[];
  if (list.length === 0) return null;
  const now = new Date();
  const cur =
    list.find((s) => s.ends_at && new Date(s.ends_at) > now) ?? list.find((s) => !s.ends_at) ?? list[0];
  return {
    id: String(cur.id),
    stage_number: cur.stage_number,
    title: cur.title ?? "",
    question: String(cur.poll_question ?? "").trim(),
  };
}

export type PollRow = { participant_id: string; votes: number; last_at: string };

// Голоса опроса этапа, сгруппированные по участницам (по убыванию).
export async function pollResults(stageId: string): Promise<{ total: number; rows: PollRow[] }> {
  const counts = new Map<string, PollRow>();
  let total = 0;
  for (let page = 0; page < 40; page++) {
    const { data } = await supabaseAdmin
      .from("stage_poll_votes")
      .select("participant_id, created_at")
      .eq("stage_id", stageId)
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    const part = (data ?? []) as any[];
    for (const r of part) {
      const k = String(r.participant_id);
      const cur = counts.get(k) ?? { participant_id: k, votes: 0, last_at: r.created_at as string };
      cur.votes += 1;
      cur.last_at = r.created_at as string;
      counts.set(k, cur);
      total += 1;
    }
    if (part.length < 1000) break;
  }
  const rows = Array.from(counts.values()).sort((a, b) => b.votes - a.votes);
  return { total, rows };
}
