import { supabase } from "@/lib/supabaseClient";

// Голоса каждой участницы с учётом штрафов за чёрные метки.
// Считает база (функция vt_vote_totals), поэтому число везде одинаковое.
export async function getVoteTotals(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const page = 1000;
  for (let from = 0; from < 50000; from += page) {
    const { data, error } = await supabase
      .rpc("vt_vote_totals")
      .range(from, from + page - 1);
    if (error || !data) break;
    (data as { participant_id: string; cnt: number }[]).forEach((r) => {
      out[r.participant_id] = Number(r.cnt);
    });
    if (data.length < page) break;
  }
  return out;
}
