import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { bunnyDeleteVideo } from "@/lib/bunny";

export const dynamic = "force-dynamic";

// Удалить свою публикацию (со всеми лайками, комментариями, отметками).
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const id = String(b.postId || "");
  if (!id) return bad("bad_request");

  const { data: p } = await supabaseAdmin
    .from("content_posts")
    .select("id, user_id, bunny_video_id, extra_media, participants(user_id)")
    .eq("id", id)
    .maybeSingle();
  if (!p) return bad("not_found", 404);
  const pp: any = Array.isArray((p as any).participants) ? (p as any).participants[0] : (p as any).participants;
  const owner = (p as any).user_id ?? pp?.user_id;
  if (owner !== me) return bad("forbidden", 403);

  const videoIds: string[] = [];
  if ((p as any).bunny_video_id) videoIds.push((p as any).bunny_video_id);
  if (Array.isArray((p as any).extra_media)) (p as any).extra_media.forEach((m: any) => m?.videoId && videoIds.push(m.videoId));

  for (const t of ["media_likes", "media_comments", "content_reposts", "content_tags"]) {
    await supabaseAdmin.from(t).delete().eq("post_id", id);
  }
  const { error } = await supabaseAdmin.from("content_posts").delete().eq("id", id);
  if (error) return bad("delete_failed", 500);
  for (const v of videoIds) {
    try {
      await bunnyDeleteVideo(v);
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
