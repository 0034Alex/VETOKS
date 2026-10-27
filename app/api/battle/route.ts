import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { rateLimit } from "@/lib/rateLimit";
import { cleanContest, inContest } from "@/lib/contest";
import { bad, blockOtherCountry, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// «Битва»: каждые 30 минут в каждом регионе — два ролика друг против друга.
// Участницы только своего шоу и своего региона (из страны не берём), без Топ-25 и без недавних.
const SLOT_MS = 30 * 60 * 1000;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function top25Ids(regionIds: string[], contest: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const m: Record<string, number> = {};
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabaseAdmin
        .rpc("vt_free_votes_between", { p_from: new Date(Date.now() - 86400_000).toISOString(), p_to: new Date().toISOString() } as any)
        .range(from, from + 999);
      if (error || !data) break;
      (data as any[]).forEach((r) => (m[r.participant_id] = Number(r.cnt)));
      if ((data as any[]).length < 1000) break;
    }
    const { data: ps } = await supabaseAdmin
      .from("participants")
      .select("id, age_category, contest")
      .eq("is_eliminated", false)
      .in("region_id", regionIds)
      .limit(20000);
    const by: Record<string, { id: string; v: number }[]> = {};
    ((ps ?? []) as any[]).forEach((p) => {
      if (!inContest(p.contest, contest) || !(m[p.id] > 0)) return;
      (by[p.age_category || "main"] ||= []).push({ id: p.id, v: m[p.id] });
    });
    Object.values(by).forEach((l) => l.sort((a, b) => b.v - a.v).slice(0, 25).forEach((x) => out.add(x.id)));
  } catch {}
  return out;
}

async function buildRound(contest: string, regionId: string, slot: number) {
  const regionIds = [regionId];
  const { data: ps } = await supabaseAdmin
    .from("participants")
    .select("id, contest, age_category")
    .eq("is_eliminated", false)
    .eq("region_id", regionId)
    .limit(5000);
  let cand = ((ps ?? []) as any[]).filter((p) => inContest(p.contest, contest)).map((p) => p.id as string);
  if (cand.length < 2) return null;
  const top = await top25Ids(regionIds, contest);
  const noTop = cand.filter((id) => !top.has(id));
  if (noTop.length >= 2) cand = noTop;

  // кого уже показывали (последние 48 раундов = сутки)
  const { data: past } = await supabaseAdmin
    .from("battle_rounds")
    .select("part_a, part_b, slot")
    .eq("contest", contest)
    .eq("region_id", regionId)
    .order("slot", { ascending: false })
    .limit(48);
  const shown: Record<string, number> = {};
  const lastPair = new Set<string>();
  ((past ?? []) as any[]).forEach((r, i) => {
    shown[r.part_a] = (shown[r.part_a] ?? 0) + 1;
    shown[r.part_b] = (shown[r.part_b] ?? 0) + 1;
    if (i < 4) { lastPair.add(r.part_a); lastPair.add(r.part_b); }
  });
  // только те, у кого есть видео
  const posts: Record<string, string[]> = {};
  for (let i = 0; i < cand.length; i += 300) {
    const { data } = await supabaseAdmin
      .from("content_posts")
      .select("id, participant_id")
      .in("participant_id", cand.slice(i, i + 300))
      .eq("visibility", "all")
      .not("video_url", "is", null)
      .or("mod_status.is.null,mod_status.eq.ok")
      .order("submitted_at", { ascending: false })
      .limit(1000);
    ((data ?? []) as any[]).forEach((r) => (posts[r.participant_id] ||= []).push(r.id));
  }
  let pool = cand.filter((id) => posts[id]?.length);
  if (pool.length < 2) return null;
  // свежие (не из последних 4 раундов) в приоритете; если мало — миксуем с повторами
  const fresh = pool.filter((id) => !lastPair.has(id));
  if (fresh.length >= 2) pool = fresh;
  // честный старт: сначала те, кого показывали реже
  const min = Math.min(...pool.map((id) => shown[id] ?? 0));
  const low = pool.filter((id) => (shown[id] ?? 0) <= min + 1);
  const a = pick(low.length >= 1 ? low : pool);
  const rest = pool.filter((id) => id !== a);
  const minR = Math.min(...rest.map((id) => shown[id] ?? 0));
  const b = pick(rest.filter((id) => (shown[id] ?? 0) <= minR + 1));
  const row = { contest, region_id: regionId, slot, part_a: a, part_b: b, post_a: pick(posts[a]), post_b: pick(posts[b]) };
  const ins = await supabaseAdmin.from("battle_rounds").insert(row).select("id").maybeSingle();
  if (ins.error) {
    const { data } = await supabaseAdmin.from("battle_rounds").select("id").eq("contest", contest).eq("region_id", regionId).eq("slot", slot).maybeSingle();
    return (data?.id as string) ?? null;
  }
  return (ins.data?.id as string) ?? null;
}

async function view(roundId: string, uid: string | null) {
  const { data: r } = await supabaseAdmin.from("battle_rounds").select("*").eq("id", roundId).maybeSingle();
  if (!r) return null;
  const [{ data: parts }, { data: posts }, { data: votes }, mine] = await Promise.all([
    supabaseAdmin.from("participants").select("id, display_name, photo_url").in("id", [r.part_a, r.part_b]),
    supabaseAdmin.from("content_posts").select("id, video_url").in("id", [r.post_a, r.post_b]),
    supabaseAdmin.from("battle_votes").select("side").eq("round_id", roundId).limit(100000),
    uid ? supabaseAdmin.from("battle_votes").select("kind, side").eq("round_id", roundId).eq("user_id", uid) : Promise.resolve({ data: [] as any[] }),
  ]);
  const pm = new Map<string, any>(((parts ?? []) as any[]).map((p) => [p.id, p]));
  const vm = new Map<string, any>(((posts ?? []) as any[]).map((p) => [p.id, p]));
  const side = (part: string, post: string) => ({
    participantId: part,
    postId: post,
    videoUrl: vm.get(post)?.video_url ?? null,
    name: pm.get(part)?.display_name ?? "—",
    photo: pm.get(part)?.photo_url ?? null,
  });
  let a = 0, b = 0;
  ((votes ?? []) as any[]).forEach((v) => (v.side === "a" ? a++ : b++));
  const my: Record<string, string> = {};
  ((mine as any).data ?? []).forEach((v: any) => (my[v.kind] = v.side));
  return {
    id: roundId,
    endsAt: new Date((Number(r.slot) + 1) * SLOT_MS).toISOString(),
    a: side(r.part_a, r.post_a),
    b: side(r.part_b, r.post_b),
    votes: { a, b },
    my,
  };
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const contest = cleanContest(b.contest);
  const action = String(b.action || "get");
  const slot = Math.floor(Date.now() / SLOT_MS);

  if (action === "get") {
    const rl = await rateLimit(req, "battle/get", 60, 60);
    if (rl) return rl;
    const uid = await userIdFromBearer(req);
    let regionId: string | null = null;
    if (uid) {
      const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
      regionId = (u?.region_id as string) ?? null;
    }
    if (!regionId) return NextResponse.json({ ok: true, round: null, nextAt: new Date((slot + 1) * SLOT_MS).toISOString() });
    let { data: r } = await supabaseAdmin.from("battle_rounds").select("id").eq("contest", contest).eq("region_id", regionId).eq("slot", slot).maybeSingle();
    let id: string | null = (r?.id as string) ?? null;
    if (!id) id = await buildRound(contest, regionId, slot);
    const round = id ? await view(id, uid) : null;
    return NextResponse.json({ ok: true, round, nextAt: new Date((slot + 1) * SLOT_MS).toISOString() });
  }

  if (action === "like" || action === "vote") {
    const uid = await requireUser(req);
    if (uid instanceof NextResponse) return uid;
    const rl = await rateLimit(req, "battle/vote", 40, 60, uid);
    if (rl) return rl;
    const side = b.side === "b" ? "b" : "a";
    const roundId = String(b.roundId || "");
    const { data: r } = await supabaseAdmin.from("battle_rounds").select("*").eq("id", roundId).maybeSingle();
    if (!r || Number(r.slot) !== slot) return bad("round_over");
    const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
    if ((u?.region_id as string) !== r.region_id) return bad("other_region", 403);
    const { data: ex } = await supabaseAdmin.from("battle_votes").select("kind").eq("round_id", roundId).eq("user_id", uid).eq("kind", action).maybeSingle();
    if (ex) return bad("already");
    const partId = side === "a" ? r.part_a : r.part_b;

    if (action === "vote") {
      // настоящий голос за участницу: сначала бесплатные, если кончились — предлагаем купить
      const oc = await blockOtherCountry(uid, partId);
      if (oc) return oc;
      const [{ data: vu }, { data: vp }] = await Promise.all([
        supabaseAdmin.from("users").select("age_category").eq("id", uid).maybeSingle(),
        supabaseAdmin.from("participants").select("age_category").eq("id", partId).maybeSingle(),
      ]);
      const cross = ((vu as any)?.age_category || "main") !== ((vp as any)?.age_category || "main");
      const { data, error } = await supabaseAdmin.rpc("vt_cast_votes_cat", { p_user: uid, p_participant: partId, p_count: 1, p_paid_only: cross });
      if (error || !data) return bad("server", 500);
      if (!(data as any).ok) return NextResponse.json(data);
    }
    const ins = await supabaseAdmin.from("battle_votes").insert({ round_id: roundId, user_id: uid, kind: action, side });
    if (ins.error && !/duplicate/i.test(ins.error.message)) return bad("server", 500);
    return NextResponse.json({ ok: true, round: await view(roundId, uid) });
  }
  return bad("bad_request");
}
