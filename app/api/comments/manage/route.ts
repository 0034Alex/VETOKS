import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { hasBadWords, BAD_WORDS_MESSAGE } from "@/lib/badWords";

export const dynamic = "force-dynamic";

// Свой комментарий: изменить или удалить. Чужие трогать нельзя.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "comments/manage", 30, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return bad("empty");

  const { data: c } = await supabaseAdmin.from("media_comments").select("id, user_id, post_id").eq("id", id).maybeSingle();
  if (!c) return bad("forbidden", 403);
  const isAuthor = (c as any).user_id === uid;

  if (b.action === "delete") {
    if (!isAuthor) {
      // Владелец публикации может убрать чужой комментарий у себя под ней.
      const { data: post } = await supabaseAdmin
        .from("content_posts")
        .select("user_id, participants(user_id)")
        .eq("id", (c as any).post_id)
        .maybeSingle();
      const pp: any = Array.isArray((post as any)?.participants) ? (post as any).participants[0] : (post as any)?.participants;
      const owner = (post as any)?.user_id ?? pp?.user_id;
      if (!owner || owner !== uid) return bad("forbidden", 403);
    }
    const { error } = await supabaseAdmin.from("media_comments").delete().eq("id", id);
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "edit") {
    if (!isAuthor) return bad("forbidden", 403);
    const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!text) return bad("empty");
    if (hasBadWords(text)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
    const { error } = await supabaseAdmin.from("media_comments").update({ body: text, edited_at: new Date().toISOString() }).eq("id", id);
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true });
  }

  return bad("bad_action");
}
