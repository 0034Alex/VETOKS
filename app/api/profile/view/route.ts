import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Засчитать просмотр видео (один человек — один просмотр, своё видео не считается).
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const postId = String(b.postId || "");
  if (!postId) return bad("bad_request");

  const { data: p } = await supabaseAdmin
    .from("content_posts")
    .select("id, user_id, video_url, participants(user_id)")
    .eq("id", postId)
    .maybeSingle();
  if (!p || !(p as any).video_url) return bad("not_found", 404);
  const pp: any = Array.isArray((p as any).participants) ? (p as any).participants[0] : (p as any).participants;
  const owner = (p as any).user_id ?? pp?.user_id;
  if (owner === me) return NextResponse.json({ ok: true, own: true });

  const { data } = await supabaseAdmin.rpc("vt_view_post", { p_post: postId, p_user: me });
  return NextResponse.json({ ok: true, views: data });
}
