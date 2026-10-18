import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { cleanVisibility } from "@/lib/postVisibility";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Скрыть свою публикацию от всех (visibility "me") и вернуть обратно на то же место.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const rl = await rateLimit(req, "post/update", 30, 60, me);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.postId || "");
  if (!id) return bad("bad_request");
  const { data: p } = await supabaseAdmin
    .from("content_posts")
    .select("id, user_id, participants(user_id)")
    .eq("id", id)
    .maybeSingle();
  if (!p) return bad("not_found", 404);
  const pp: any = Array.isArray((p as any).participants) ? (p as any).participants[0] : (p as any).participants;
  const owner = (p as any).user_id ?? pp?.user_id;
  if (owner !== me) return bad("forbidden", 403);
  const visibility = cleanVisibility(b.visibility);
  const { error } = await supabaseAdmin.from("content_posts").update({ visibility }).eq("id", id);
  if (error) return bad("update_failed", 500);
  return NextResponse.json({ ok: true, visibility });
}
