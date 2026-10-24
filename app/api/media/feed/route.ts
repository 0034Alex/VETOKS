import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfRegion } from "@/lib/countryServer";
import { pickPack, fallbackIds } from "@/lib/mediaFeed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Следующая порция ленты «Медиа» (10 роликов): без повторов, с честным стартом.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const uid = await userIdFromBearer(req);
  const device = typeof b.device === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.device) ? b.device : "";
  const viewer = uid ?? (device ? `d:${device}` : "");
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 400 });
  const rl = await rateLimit(req, "media/feed", 90, 60, viewer);
  if (rl) return rl;

  // страна и регион: у входящих — из профиля, у гостей — из страны, которую передал телефон
  let regionId: string | null = null;
  let countryId: string | null = null;
  if (uid) {
    const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
    regionId = (u?.region_id as string) ?? null;
    countryId = await countryOfRegion(regionId);
  }
  if (!countryId && typeof b.countryId === "string" && b.countryId.length < 64) countryId = b.countryId;
  if (!countryId) {
    // гость без страны: берём первую включённую страну
    const { data: c } = await supabaseAdmin.from("countries").select("id").eq("enabled", true).limit(1).maybeSingle();
    countryId = (c?.id as string) ?? null;
  }
  if (!countryId) return NextResponse.json({ ok: true, posts: [], likes: {}, comments: {}, liked: [], followed: [] });

  const tab = b.tab === "following" || b.tab === "country" ? b.tab : "region";
  const cats = Array.isArray(b.cats) ? b.cats.map(String).slice(0, 3) : [];
  const exclude = Array.isArray(b.exclude) ? b.exclude.filter((x: any) => typeof x === "string" && UUID.test(x)).slice(0, 300) : [];
  const page = Math.max(0, Math.min(200, Number(b.page) || 0));

  let { ids, followedPart } = await pickPack({ countryId, viewer, userId: uid, regionId, cats, tab, exclude, page });
  if (!ids.length && tab !== "following") ids = await fallbackIds(countryId, cats, exclude);
  if (!ids.length) return NextResponse.json({ ok: true, posts: [], likes: {}, comments: {}, liked: [], followed: [...followedPart] });

  const [{ data: posts }, { data: counts }, likedRes] = await Promise.all([
    supabaseAdmin
      .from("content_posts")
      .select("id, video_url, caption, participant_id, participants(display_name, photo_url, region_id, season_id, user_id, age_category)")
      .in("id", ids),
    supabaseAdmin.rpc("media_counts", { p_ids: ids }),
    uid ? supabaseAdmin.from("media_likes").select("post_id").eq("user_id", uid).in("post_id", ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const byId = new Map<string, any>(((posts ?? []) as any[]).map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  const likes: Record<string, number> = {};
  const comments: Record<string, number> = {};
  ((counts as any[]) ?? []).forEach((c) => {
    likes[c.post_id] = Number(c.likes);
    comments[c.post_id] = Number(c.comments);
  });
  return NextResponse.json({
    ok: true,
    posts: ordered,
    likes,
    comments,
    liked: ((likedRes as any).data ?? []).map((r: any) => r.post_id),
    followed: [...followedPart],
  });
}
