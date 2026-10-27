import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser, regionIdsOfCountry } from "@/lib/countryServer";
import { inContest } from "@/lib/contest";

export const dynamic = "force-dynamic";

// Опрос на главной шоу: вопрос задаётся в CRM → «Шоу». Один ответ на вопрос, бесплатно.
// Участницы — только этого шоу и своей страны. Результаты видны после ответа.
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "show/poll", 60, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  const { data: show } = await supabaseAdmin.from("shows").select("id, contest, banner").eq("id", String(b.showId || "")).maybeSingle();
  const question = String((show?.banner as any)?.poll_question ?? "").trim();
  if (!show || !question) return NextResponse.json({ ok: true, question: "", answered: false, results: [], total: 0 });
  const key = `${show.id}:${hash(question)}`;
  const contest = String(show.contest || "miss");

  const countryId = await countryOfUser(uid);
  const regionIds = countryId ? await regionIdsOfCountry(countryId) : [];

  const { data: prev } = await supabaseAdmin.from("show_poll_votes").select("participant_id").eq("poll_key", key).eq("user_id", uid).maybeSingle();
  let myPid: string | null = (prev?.participant_id as string) ?? null;

  if (b.action === "search" && !myPid) {
    const q = String(b.q ?? "").replace(/[%_,()]/g, " ").trim().slice(0, 40);
    if (!q || !regionIds.length) return NextResponse.json({ ok: true, items: [] });
    const { data } = await supabaseAdmin
      .from("participants")
      .select("id, display_name, photo_url, contest")
      .eq("is_eliminated", false)
      .in("region_id", regionIds)
      .ilike("display_name", `%${q}%`)
      .limit(20);
    const items = ((data ?? []) as any[])
      .filter((p) => inContest(p.contest, contest))
      .slice(0, 5)
      .map((p) => ({ id: p.id as string, name: p.display_name as string, photo: (p.photo_url as string | null) ?? null }));
    return NextResponse.json({ ok: true, items });
  }

  if (b.action === "answer" && !myPid) {
    const pid = String(b.participantId ?? "");
    const { data: p } = await supabaseAdmin.from("participants").select("id, region_id, is_eliminated, contest").eq("id", pid).maybeSingle();
    if (!p || (p as any).is_eliminated || !inContest((p as any).contest, contest) || (regionIds.length && !regionIds.includes((p as any).region_id))) return bad("not_found", 404);
    const { error } = await supabaseAdmin.from("show_poll_votes").insert({ poll_key: key, user_id: uid, participant_id: pid });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) return bad("failed", 500);
    myPid = pid;
  }

  const { count: voters } = await supabaseAdmin.from("show_poll_votes").select("user_id", { count: "exact", head: true }).eq("poll_key", key);
  if (!myPid) return NextResponse.json({ ok: true, question, answered: false, results: [], total: 0, voters: voters ?? 0 });

  const { data: all } = await supabaseAdmin.from("show_poll_votes").select("participant_id").eq("poll_key", key).limit(100000);
  const cnt = new Map<string, number>();
  ((all ?? []) as any[]).forEach((r) => cnt.set(r.participant_id, (cnt.get(r.participant_id) ?? 0) + 1));
  const total = Array.from(cnt.values()).reduce((a, n) => a + n, 0);
  const ids = Array.from(cnt.keys());
  const info = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from("participants").select("id, display_name, photo_url").in("id", ids.slice(i, i + 200));
    ((data ?? []) as any[]).forEach((p) => info.set(p.id, p));
  }
  let results = ids
    .filter((id) => info.has(id))
    .map((id) => ({ id, name: info.get(id).display_name as string, photo: (info.get(id).photo_url as string | null) ?? null, votes: cnt.get(id)!, pct: total ? Math.round((cnt.get(id)! / total) * 100) : 0, mine: id === myPid }))
    .sort((a, c) => c.votes - a.votes);
  const mine = results.find((r) => r.mine);
  results = results.slice(0, 5);
  if (mine && !results.some((r) => r.mine)) results.push(mine);
  return NextResponse.json({ ok: true, question, answered: true, results, total, voters: total });
}
