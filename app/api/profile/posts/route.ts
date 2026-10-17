import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Подробности публикаций для ленты-просмотра: автор, подпись, лайки, комментарии, просмотры.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 80) : [];
  if (!ids.length) return NextResponse.json({ ok: true, items: [], meId: me });

  const { data: posts } = await supabaseAdmin
    .from("content_posts")
    .select("id, participant_id, user_id, video_url, photo_url, caption, views, submitted_at, participants(user_id, display_name, photo_url)")
    .in("id", ids);

  const ownerOf = (p: any) => {
    const pp = Array.isArray(p.participants) ? p.participants[0] : p.participants;
    return (p.user_id ?? pp?.user_id) as string | undefined;
  };
  const ownerIds = Array.from(new Set((posts ?? []).map(ownerOf).filter(Boolean))) as string[];
  const { data: users } = ownerIds.length
    ? await supabaseAdmin.from("users").select("id, first_name, nick, photo_url").in("id", ownerIds)
    : { data: [] as any[] };
  const um: Record<string, any> = {};
  (users ?? []).forEach((u: any) => (um[u.id] = u));

  const { data: likes } = await supabaseAdmin.from("media_likes").select("post_id, user_id").in("post_id", ids);
  const { data: comments } = await supabaseAdmin.from("media_comments").select("post_id").in("post_id", ids);
  const { data: reps } = await supabaseAdmin.from("content_reposts").select("post_id").eq("user_id", me).in("post_id", ids);
  const likeCount: Record<string, number> = {};
  const liked = new Set<string>();
  (likes ?? []).forEach((l: any) => {
    likeCount[l.post_id] = (likeCount[l.post_id] ?? 0) + 1;
    if (l.user_id === me) liked.add(l.post_id);
  });
  const comCount: Record<string, number> = {};
  (comments ?? []).forEach((c: any) => (comCount[c.post_id] = (comCount[c.post_id] ?? 0) + 1));
  const repSet = new Set((reps ?? []).map((r: any) => r.post_id));

  // Страна автора должна совпадать со страной смотрящего.
  const okOwner: Record<string, boolean> = {};
  for (const o of ownerIds) okOwner[o] = o === me ? true : await sameCountry(me, o);

  const items = (posts ?? [])
    .filter((p: any) => {
      const o = ownerOf(p);
      return !!o && okOwner[o];
    })
    .map((p: any) => {
      const pp = Array.isArray(p.participants) ? p.participants[0] : p.participants;
      const o = ownerOf(p) as string;
      const u = um[o] ?? {};
      return {
        id: p.id as string,
        kind: p.video_url ? "video" : "photo",
        url: (p.video_url || p.photo_url) as string,
        caption: (p.caption as string) ?? "",
        createdAt: p.submitted_at as string,
        views: Number(p.views) || 0,
        ownerUserId: o,
        authorName: pp?.display_name || u.first_name || u.nick || "Гость",
        authorSub: pp ? "Участница" : u.nick ? `@${u.nick}` : "",
        authorPhoto: pp?.photo_url ?? u.photo_url ?? null,
        authorHref: p.participant_id ? `/participant/${p.participant_id}` : `/u/${o}`,
        likes: likeCount[p.id] ?? 0,
        liked: liked.has(p.id),
        comments: comCount[p.id] ?? 0,
        reposted: repSet.has(p.id),
        mine: o === me,
      };
    });
  return NextResponse.json({ ok: true, items, meId: me });
}
