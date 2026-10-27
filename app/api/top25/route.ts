import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { rateLimit } from "@/lib/rateLimit";
import { cleanContest, inContest } from "@/lib/contest";
import { countryOfRegion, regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Row = { rank: number; participant_id: string; votes: number; display_name: string; photo_url: string | null };
const cache = new Map<string, { at: number; rows: Row[] }>();

async function rpcMap(fn: string, args: object): Promise<Record<string, number>> {
  const m: Record<string, number> = {};
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await supabaseAdmin.rpc(fn, args as any).range(from, from + 999);
    if (error || !data) break;
    (data as any[]).forEach((r) => (m[r.participant_id] = Number(r.cnt)));
    if ((data as any[]).length < 1000) break;
  }
  return m;
}

// Топ-25 за последние 24 часа (бесплатные голоса), обновляется каждую минуту.
export async function POST(req: Request) {
  const rl = await rateLimit(req, "top25", 60, 60);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const contest = cleanContest(b.contest);
  const cat = ["teen", "main", "adult"].includes(b.cat) ? (b.cat as string) : "main";

  let countryId: string | null = null;
  const uid = await userIdFromBearer(req);
  if (uid) {
    const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
    countryId = await countryOfRegion((u?.region_id as string) ?? null);
  }
  if (!countryId && typeof b.countryId === "string" && b.countryId.length < 64) countryId = b.countryId;
  if (!countryId) {
    const { data: c } = await supabaseAdmin.from("countries").select("id").eq("enabled", true).limit(1).maybeSingle();
    countryId = (c?.id as string) ?? null;
  }
  if (!countryId) return NextResponse.json({ ok: true, rows: [], updatedAt: new Date().toISOString() });

  const key = `${countryId}:${cat}:${contest}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return NextResponse.json({ ok: true, rows: hit.rows, updatedAt: new Date(hit.at).toISOString() });

  const regionIds = await regionIdsOfCountry(countryId);
  if (!regionIds.length) return NextResponse.json({ ok: true, rows: [], updatedAt: new Date().toISOString() });
  const { data: ps } = await supabaseAdmin
    .from("participants")
    .select("id, display_name, photo_url, age_category, contest")
    .eq("is_eliminated", false)
    .in("region_id", regionIds)
    .limit(20000);
  const list = ((ps ?? []) as any[]).filter((p) => (p.age_category || "main") === cat && inContest(p.contest, contest));
  const day = await rpcMap("vt_free_votes_between", { p_from: new Date(Date.now() - 86400_000).toISOString(), p_to: new Date().toISOString() });
  const totals = await rpcMap("vt_vote_totals", {});
  const rows: Row[] = list
    .filter((p) => (day[p.id] ?? 0) > 0)
    .sort((a, c) => (day[c.id] ?? 0) - (day[a.id] ?? 0) || (totals[c.id] ?? 0) - (totals[a.id] ?? 0))
    .slice(0, 25)
    .map((p, i) => ({ rank: i + 1, participant_id: p.id, votes: day[p.id], display_name: p.display_name ?? "—", photo_url: p.photo_url ?? null }));
  cache.set(key, { at: Date.now(), rows });
  return NextResponse.json({ ok: true, rows, updatedAt: new Date().toISOString() });
}
