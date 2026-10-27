// Лента «Медиа»: пул кандидатов (пересобирается раз в несколько минут) + подбор порции для человека.
// Принципы: честный старт (меньше показов — раньше), вес по вовлечению с затуханием,
// без повторов (media_seen), не больше 2 роликов одной участницы в порции, лента не пустеет.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { inContest } from "@/lib/contest";
import { regionIdsOfCountry, settingsForCountry } from "@/lib/countryServer";

export const CATS = ["teen", "main", "adult"] as const;
const POOL_TTL_MS = 3 * 60 * 1000; // пул пересобираем не чаще раза в 3 минуты
const CACHE_MS = 60 * 1000; // в памяти сервера держим 1 минуту
const AVG_VIDEOS_PER_SESSION = 20;

type Row = { contest?: string; post_id: string; participant_id: string | null; region_id: string | null; theme_id: string | null; score: number; bucket: string; age_category: string };
const cache = new Map<string, { at: number; gen: number; rows: Row[] }>();
// Сколько раз ролик выдан с момента сборки пула: чтобы за 3 минуты один и тот же «самый непоказанный» не получил лишних сотен показов.
const served = new Map<string, number>();

const num = (v: any, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const chunk = <T,>(a: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
};
const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// ── Сезон, активная и прошлая тема ──────────────────────────────────────────
async function seasonFor(countryId: string, set: Record<string, string>): Promise<string> {
  let seasonId = set.media_season_id || "";
  if (seasonId) {
    const { data } = await supabaseAdmin.from("seasons").select("country_id").eq("id", seasonId).maybeSingle();
    if (data?.country_id && String(data.country_id) !== String(countryId)) seasonId = "";
  }
  if (!seasonId) {
    const { data } = await supabaseAdmin.from("seasons").select("id").eq("country_id", countryId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    seasonId = (data?.id as string) || "";
  }
  return seasonId;
}

export async function themesFor(countryId: string) {
  const { data } = await supabaseAdmin
    .from("media_themes")
    .select("id, title, kind, starts_at, ends_at, country_id")
    .or(`country_id.eq.${countryId},country_id.is.null`)
    .order("starts_at", { ascending: false })
    .limit(30);
  const now = Date.now();
  const list = (data ?? []) as any[];
  const active = list.find((t) => new Date(t.starts_at).getTime() <= now && now <= new Date(t.ends_at).getTime()) ?? null;
  const prev = list.find((t) => new Date(t.ends_at).getTime() < now && (!active || t.id !== active.id)) ?? null;
  return { active, prev, list };
}

// ── Сборка пула ─────────────────────────────────────────────────────────────
export async function buildPool(countryId: string): Promise<number> {
  const set = await settingsForCountry(["media_season_id", "media_quota_min", "media_quota_max"], countryId);
  const seasonId = await seasonFor(countryId, set);
  const regionIds = await regionIdsOfCountry(countryId);
  const { active, prev } = await themesFor(countryId);
  const qMin = num(set.media_quota_min, 20);
  const qMax = Math.max(qMin, num(set.media_quota_max, 300));

  // 1) все видео-посты участниц сезона этой страны
  type P = { id: string; participant_id: string; theme_id: string | null; submitted_at: string; cat: string; region_id: string | null };
  const posts: P[] = [];
  if (regionIds.length) {
    for (let from = 0; from < 20000; from += 1000) {
      let q = supabaseAdmin
        .from("content_posts")
        .select("id, participant_id, theme_id, submitted_at, participants!inner(age_category, region_id, season_id, is_eliminated)")
        .eq("visibility", "all")
        .not("video_url", "is", null)
        .not("participant_id", "is", null)
        .or("mod_status.is.null,mod_status.eq.ok")
        .in("participants.region_id", regionIds)
        .range(from, from + 999);
      if (seasonId) q = q.eq("participants.season_id", seasonId);
      let res: any = await q;
      if (res.error && /theme_id/.test(res.error.message || "")) {
        // колонка темы ещё не создана — собираем без неё
        let q2 = supabaseAdmin
          .from("content_posts")
          .select("id, participant_id, submitted_at, participants!inner(age_category, region_id, season_id, is_eliminated)")
          .eq("visibility", "all")
          .not("video_url", "is", null)
          .not("participant_id", "is", null)
          .in("participants.region_id", regionIds)
          .range(from, from + 999);
        if (seasonId) q2 = q2.eq("participants.season_id", seasonId);
        res = await q2;
      }
      const rows = (res.data ?? []) as any[];
      for (const r of rows) {
        const pt = Array.isArray(r.participants) ? r.participants[0] : r.participants;
        if (!pt || pt.is_eliminated) continue;
        posts.push({ id: r.id, participant_id: r.participant_id, theme_id: r.theme_id ?? null, submitted_at: r.submitted_at, cat: pt.age_category || "main", region_id: pt.region_id ?? null });
      }
      if (rows.length < 1000) break;
    }
  }

  // 2) статистика и лайки/комментарии
  const ids = posts.map((p) => p.id);
  const stats = new Map<string, any>();
  for (const part of chunk(ids, 400)) {
    const { data } = await supabaseAdmin.from("media_post_stats").select("post_id, impressions, qualified, completes, shares, pinned, hidden").in("post_id", part);
    (data ?? []).forEach((s: any) => stats.set(s.post_id, s));
  }
  const lc = new Map<string, { likes: number; comments: number }>();
  for (const part of chunk(ids, 400)) {
    const { data } = await supabaseAdmin.rpc("media_counts", { p_ids: part });
    ((data as any[]) ?? []).forEach((c) => lc.set(c.post_id, { likes: Number(c.likes), comments: Number(c.comments) }));
  }

  // 3) квота честного старта — от размера живой аудитории
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: av } = await supabaseAdmin.rpc("media_active_viewers", { p_since: since });
  const viewers = num(av, 0);
  const themeVideos = active ? posts.filter((p) => p.theme_id === active.id).length : 0;
  const quota = Math.min(qMax, Math.max(qMin, Math.round((viewers * AVG_VIDEOS_PER_SESSION * 0.5) / Math.max(1, themeVideos))));

  // 4) вес и пересчёт
  const now = Date.now();
  type S = P & { impr: number; weight: number; pinned: boolean };
  const scored: S[] = [];
  const upserts: any[] = [];
  for (const p of posts) {
    const s = stats.get(p.id) ?? {};
    if (s.hidden) continue;
    const impr = num(s.impressions, 0);
    const l = lc.get(p.id) ?? { likes: 0, comments: 0 };
    const rate = (num(s.qualified, 0) * 1 + num(s.completes, 0) * 2 + l.likes * 3 + l.comments * 5 + num(s.shares, 0) * 8) / (impr + 10);
    const ageH = Math.max(0, (now - new Date(p.submitted_at).getTime()) / 3600000);
    const weight = rate * Math.log(2 + impr) * Math.pow(0.5, ageH / 36);
    scored.push({ ...p, impr, weight, pinned: !!s.pinned });
    upserts.push({ post_id: p.id, weight, updated_at: new Date().toISOString() });
  }
  for (const part of chunk(upserts, 500)) await supabaseAdmin.from("media_post_stats").upsert(part, { onConflict: "post_id" });

  // 5) корзины на каждую возрастную категорию
  const out: any[] = [];
  const gen = Date.now();
  for (const cat of CATS) {
    const inCat = scored.filter((p) => p.cat === cat);
    const inAct = active ? inCat.filter((p) => p.theme_id === active.id) : [];
    const add = (bucket: string, list: S[], scoreOf: (p: S) => number, limit: number) =>
      list.slice(0, limit).forEach((p) =>
        out.push({ country_id: countryId, age_category: cat, bucket, post_id: p.id, participant_id: p.participant_id, region_id: p.region_id, theme_id: p.theme_id, score: scoreOf(p), gen })
      );
    // честный старт: у кого меньше показов — тот раньше
    add("fresh", inAct.filter((p) => p.impr < quota).sort((a, b) => a.impr - b.impr), (p) => p.impr, 600);
    // хиты текущей темы (закреплённые — всегда наверху)
    add("hot", [...inAct].filter((p) => p.pinned || p.weight > 0).sort((a, b) => (b.pinned ? 1e6 : b.weight) - (a.pinned ? 1e6 : a.weight)), (p) => (p.pinned ? 1e6 : p.weight), 300);
    // лучшее прошлой темы
    if (prev) add("prev", inCat.filter((p) => p.theme_id === prev.id).sort((a, b) => b.weight - a.weight), (p) => p.weight, 150);
    // второй шанс: старые ролики, которые почти никто не видел
    add("second", inCat.filter((p) => !active || p.theme_id !== active.id).filter((p) => p.impr < 30).sort((a, b) => a.impr - b.impr), (p) => p.impr, 200);
    // запас: лучшее за всё время
    add("old", [...inCat].sort((a, b) => b.weight - a.weight), (p) => p.weight, 300);
  }

  // 6) записываем новое поколение и переключаем
  for (const part of chunk(out, 500)) {
    const { error } = await supabaseAdmin.from("media_pool").insert(part);
    if (error) throw new Error(error.message);
  }
  await supabaseAdmin.from("media_pool_meta").upsert({ key: `pool:${countryId}`, built_at: new Date().toISOString(), gen }, { onConflict: "key" });
  await supabaseAdmin.from("media_pool").delete().eq("country_id", countryId).lt("gen", gen);
  cache.delete(countryId);
  return out.length;
}

// Пул обновляем лениво: кто первый заметил, что он старше 3 минут — тот и пересобирает.
async function ensurePool(countryId: string): Promise<void> {
  const key = `pool:${countryId}`;
  const { data: meta } = await supabaseAdmin.from("media_pool_meta").select("built_at, gen").eq("key", key).maybeSingle();
  if (!meta) {
    await supabaseAdmin.from("media_pool_meta").upsert({ key, built_at: new Date(0).toISOString(), gen: 0 }, { onConflict: "key", ignoreDuplicates: true });
    await buildPool(countryId).catch(() => null);
    return;
  }
  if (Date.now() - new Date(meta.built_at as string).getTime() < POOL_TTL_MS) return;
  const stale = new Date(Date.now() - POOL_TTL_MS).toISOString();
  const { data: claimed } = await supabaseAdmin.from("media_pool_meta").update({ built_at: new Date().toISOString() }).eq("key", key).lt("built_at", stale).select("key");
  if (claimed && claimed.length) {
    // ждём: на Vercel незавершённая фоновая работа обрывается после ответа
    await buildPool(countryId).catch(() => null);
  }
}

async function loadRows(countryId: string): Promise<Row[]> {
  const c = cache.get(countryId);
  if (c && Date.now() - c.at < CACHE_MS) return c.rows;
  const { data: meta } = await supabaseAdmin.from("media_pool_meta").select("gen").eq("key", `pool:${countryId}`).maybeSingle();
  const gen = Number(meta?.gen ?? 0);
  const rows: Row[] = [];
  if (gen) {
    for (let from = 0; from < 20000; from += 1000) {
      const { data } = await supabaseAdmin
        .from("media_pool")
        .select("post_id, participant_id, region_id, theme_id, score, bucket, age_category")
        .eq("country_id", countryId)
        .eq("gen", gen)
        .range(from, from + 999);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }
  }
  // шоу, к которому относится участница: у всех, кроме Miss, оно проставлено явно
  const other = new Map<string, string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabaseAdmin.from("participants").select("id, contest").not("contest", "is", null).neq("contest", "miss").range(from, from + 999);
    (data ?? []).forEach((x: any) => other.set(x.id, x.contest));
    if (!data || data.length < 1000) break;
  }
  rows.forEach((r) => { r.contest = (r.participant_id && other.get(r.participant_id)) || "miss"; });
  cache.set(countryId, { at: Date.now(), gen, rows });
  served.clear();
  return rows;
}

// ── Подбор порции ───────────────────────────────────────────────────────────
export type PackIn = {
  countryId: string;
  viewer: string;
  userId: string | null;
  regionId: string | null;
  cats: string[];
  tab: "region" | "country" | "following";
  exclude: string[];
  page: number;
  contest?: string;
  limit?: number;
};

export async function pickPack(a: PackIn): Promise<{ ids: string[]; followedPart: Set<string> }> {
  const limit = a.limit ?? 10;
  const contest = a.contest ?? "miss";
  const cats = a.cats.filter((c) => (CATS as readonly string[]).includes(c));
  const catSet = new Set(cats.length ? cats : ["main", "adult"]);

  // подписки и своя анкета
  let followed = new Set<string>();
  let myPart: string | null = null;
  if (a.userId) {
    const [{ data: f }, { data: mp }] = await Promise.all([
      supabaseAdmin.from("participant_follows").select("participant_id").eq("user_id", a.userId),
      supabaseAdmin.from("participants").select("id").eq("user_id", a.userId).maybeSingle(),
    ]);
    followed = new Set((f ?? []).map((x: any) => x.participant_id as string));
    myPart = (mp?.id as string) ?? null;
  }

  // вкладка «Подписки»: просто свежие ролики тех, на кого подписан
  if (a.tab === "following") {
    if (!followed.size) return { ids: [], followedPart: followed };
    const { data } = await supabaseAdmin
      .from("content_posts")
      .select("id, participants!inner(age_category, contest)")
      .in("participant_id", [...followed].slice(0, 300))
      .eq("visibility", "all")
      .not("video_url", "is", null)
      .or("mod_status.is.null,mod_status.eq.ok")
      .order("submitted_at", { ascending: false })
      .range(a.page * limit, a.page * limit + limit - 1);
    const ids = ((data ?? []) as any[])
      .filter((r) => { const pt = Array.isArray(r.participants) ? r.participants[0] : r.participants; return catSet.has(pt?.age_category || "main") && inContest(pt?.contest, contest); })
      .map((r) => r.id as string);
    return { ids, followedPart: followed };
  }

  await ensurePool(a.countryId);
  const rows = (await loadRows(a.countryId)).filter((r) => catSet.has(r.age_category) && r.participant_id !== myPart && inContest(r.contest, contest));

  // что человек уже видел
  const seen = new Set<string>(a.exclude);
  if (a.viewer) {
    const { data } = await supabaseAdmin.from("media_seen").select("post_id").eq("viewer", a.viewer).order("seen_at", { ascending: false }).limit(5000);
    (data ?? []).forEach((s: any) => seen.add(s.post_id as string));
  }

  const { active } = await themesFor(a.countryId);
  const by = (b: string) => rows.filter((r) => r.bucket === b);
  const taken = new Set<string>();
  const perPart = new Map<string, number>();
  const picked: string[] = [];
  const take = (list: Row[], n: number, allowSeen = false) => {
    let got = 0;
    for (const r of list) {
      if (picked.length >= limit || got >= n) break;
      if (taken.has(r.post_id)) continue;
      if (!allowSeen && seen.has(r.post_id)) continue;
      const pc = perPart.get(r.participant_id ?? "") ?? 0;
      if (pc >= 2) continue;
      taken.add(r.post_id);
      perPart.set(r.participant_id ?? "", pc + 1);
      picked.push(r.post_id);
      got++;
    }
  };
  const sv = (r: Row) => r.score + (served.get(r.post_id) ?? 0);
  const freshAll = by("fresh").sort((x, y) => sv(x) - sv(y));
  const fresh = [...shuffle(freshAll.slice(0, 80)), ...freshAll.slice(80)];
  const hot = by("hot").sort((x, y) => y.score - x.score);
  const hotMix = [...shuffle(hot.slice(0, 60)), ...hot.slice(60)];

  // доля «лучшего прошлой темы» в первые сутки новой темы плавно падает до нуля
  let prevSlots = 0;
  if (active) {
    const h = (Date.now() - new Date(active.starts_at).getTime()) / 3600000;
    prevSlots = Math.round(limit * 0.3 * Math.max(0, 1 - h / 24));
  }
  const social = shuffle(rows.filter((r) => (r.participant_id && followed.has(r.participant_id)) || (a.tab === "region" && a.regionId && r.region_id === a.regionId && r.bucket === "fresh")));

  take(social, a.tab === "region" ? 3 : 2);
  if (prevSlots) take(shuffle(by("prev").slice(0, 60)), prevSlots);
  take(fresh, 4);
  take(hotMix, 4);
  // добор, если чего-то не хватило
  take(fresh, limit);
  take(hotMix, limit);
  take(shuffle(by("second")), limit);
  take(shuffle(by("prev")), limit);
  take(shuffle(by("old").slice(0, 150)), limit);
  // лента не должна пустеть: если всё уже видели — показываем давно виденное
  if (picked.length < limit) take(shuffle([...hot, ...by("old")]), limit, true);

  picked.forEach((id) => served.set(id, (served.get(id) ?? 0) + 1));
  return { ids: shuffle(picked), followedPart: followed };
}

// Запасной вариант, если пул ещё не собран: свежие ролики страны.
export async function fallbackIds(countryId: string, cats: string[], exclude: string[], limit = 10, contest = "miss"): Promise<string[]> {
  const regionIds = await regionIdsOfCountry(countryId);
  if (!regionIds.length) return [];
  const { data } = await supabaseAdmin
    .from("content_posts")
    .select("id, participants!inner(age_category, region_id, contest)")
    .eq("visibility", "all")
    .not("video_url", "is", null)
    .not("participant_id", "is", null)
    .or("mod_status.is.null,mod_status.eq.ok")
    .in("participants.region_id", regionIds)
    .order("submitted_at", { ascending: false })
    .limit(60);
  const catSet = new Set(cats.length ? cats : ["main", "adult"]);
  const ex = new Set(exclude);
  return shuffle(
    ((data ?? []) as any[])
      .filter((r) => { const pt = Array.isArray(r.participants) ? r.participants[0] : r.participants; return catSet.has(pt?.age_category || "main") && !ex.has(r.id) && inContest(pt?.contest, contest); })
      .map((r) => r.id as string)
  ).slice(0, limit);
}
