import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Данные для карточки «Проголосуй за меня»: имя, фото, регион, место в регионе.
// Это то, что и так видно в конкурсе, поэтому карточку можно открыть без входа.
export type CardInfo = {
  id: string;
  name: string;
  photoUrl: string | null;
  region: string | null;
  rank: number | null;
  inRegion: number;
  votes: number;
  nick: string | null;
};

async function allTotals(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const page = 1000;
  for (let from = 0; from < 50000; from += page) {
    const { data, error } = await supabaseAdmin.rpc("vt_vote_totals").range(from, from + page - 1);
    if (error || !data) break;
    (data as { participant_id: string; cnt: number }[]).forEach((r) => (out[r.participant_id] = Number(r.cnt)));
    if (data.length < page) break;
  }
  return out;
}

export async function getCardInfo(participantId: string): Promise<CardInfo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(participantId)) return null;
  const { data: p } = await supabaseAdmin
    .from("participants")
    .select("id, display_name, photo_url, user_id, region_id, is_eliminated, age_category")
    .eq("id", participantId)
    .maybeSingle();
  if (!p) return null;
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("photo_url, nick, is_banned, regions(name)")
    .eq("id", p.user_id)
    .maybeSingle();
  if (u?.is_banned) return null;
  const region = (Array.isArray((u as any)?.regions) ? (u as any).regions[0]?.name : (u as any)?.regions?.name) ?? null;

  let rank: number | null = null;
  let inRegion = 0;
  let votes = 0;
  if (p.region_id) {
    const { data: mates } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("region_id", p.region_id)
      .eq("age_category", (p as any).age_category ?? "main")
      .eq("is_eliminated", false);
    const totals = await allTotals();
    const ids = (mates ?? []).map((m: any) => m.id as string);
    inRegion = ids.length;
    votes = totals[p.id] ?? 0;
    rank = 1 + ids.filter((id) => (totals[id] ?? 0) > votes).length;
  }
  return {
    id: p.id,
    name: p.display_name,
    photoUrl: p.photo_url ?? (u as any)?.photo_url ?? null,
    region,
    rank,
    inRegion,
    votes,
    nick: (u as any)?.nick ?? null,
  };
}
