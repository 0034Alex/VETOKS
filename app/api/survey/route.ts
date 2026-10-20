import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser, regionIdsOfCountry } from "@/lib/countryServer";
import { currentStageOfCountry, pollResults } from "@/lib/stagePoll";

export const dynamic = "force-dynamic";

// Опрос на главной: вопрос задан на текущем этапе (CRM → Этапы сезона).
// Человек выбирает участницу своей страны — один голос на этап, бесплатно.
// Результаты (за кого голосовали, по убыванию) видны только после голоса.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "survey", 60, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  const countryId = await countryOfUser(uid);
  const stage = await currentStageOfCountry(countryId);
  if (!stage || !stage.question) return NextResponse.json({ ok: true, question: "", answered: false, results: [], total: 0 });

  const regionIds = countryId ? await regionIdsOfCountry(countryId) : [];

  const { data: prev } = await supabaseAdmin
    .from("stage_poll_votes")
    .select("participant_id")
    .eq("stage_id", stage.id)
    .eq("user_id", uid)
    .limit(1);
  let myPid: string | null = (prev ?? []).length ? String((prev as any[])[0].participant_id) : null;

  if (b.action === "search" && !myPid) {
    const q = String(b.q ?? "").replace(/[%_,()]/g, " ").trim().slice(0, 40);
    if (!q || regionIds.length === 0) return NextResponse.json({ ok: true, items: [] });
    const { data } = await supabaseAdmin
      .from("participants")
      .select("id, display_name, photo_url, region_id")
      .eq("is_eliminated", false)
      .in("region_id", regionIds)
      .ilike("display_name", `%${q}%`)
      .limit(5);
    const rids = Array.from(new Set(((data ?? []) as any[]).map((p) => p.region_id).filter(Boolean)));
    const { data: rg } = rids.length ? await supabaseAdmin.from("regions").select("id, name").in("id", rids as string[]) : { data: [] as any[] };
    const rn = new Map<string, string>(((rg ?? []) as any[]).map((r) => [r.id, r.name]));
    const items = ((data ?? []) as any[]).map((p) => ({
      id: p.id as string,
      name: p.display_name as string,
      photo: (p.photo_url as string | null) ?? null,
      region: rn.get(p.region_id) ?? "",
    }));
    return NextResponse.json({ ok: true, items });
  }

  if (b.action === "answer" && !myPid) {
    const pid = String(b.participantId ?? "");
    if (!pid) return bad("empty");
    const { data: p } = await supabaseAdmin
      .from("participants")
      .select("id, region_id, is_eliminated")
      .eq("id", pid)
      .maybeSingle();
    if (!p || (p as any).is_eliminated || (regionIds.length && !regionIds.includes((p as any).region_id))) return bad("not_found", 404);
    const { error } = await supabaseAdmin
      .from("stage_poll_votes")
      .insert({ stage_id: stage.id, user_id: uid, participant_id: pid });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) return bad("failed", 500);
    myPid = pid;
  }

  if (!myPid) return NextResponse.json({ ok: true, question: stage.question, answered: false, results: [], total: 0 });

  const { total, rows } = await pollResults(stage.id);
  const ids = rows.map((r) => r.participant_id);
  const info = new Map<string, { name: string; photo: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from("participants").select("id, display_name, photo_url").in("id", ids.slice(i, i + 200));
    ((data ?? []) as any[]).forEach((p) => info.set(p.id, { name: p.display_name, photo: p.photo_url ?? null }));
  }
  let results = rows
    .filter((r) => info.has(r.participant_id))
    .map((r) => ({
      id: r.participant_id,
      name: info.get(r.participant_id)!.name,
      photo: info.get(r.participant_id)!.photo,
      votes: r.votes,
      pct: total ? Math.round((r.votes / total) * 100) : 0,
      mine: r.participant_id === myPid,
    }));
  const mine = results.find((r) => r.mine);
  if (mine) results = [mine, ...results.filter((r) => !r.mine)];
  return NextResponse.json({ ok: true, question: stage.question, answered: true, results, total });
}
