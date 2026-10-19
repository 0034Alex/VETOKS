import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { hasBadWords, BAD_WORDS_MESSAGE } from "@/lib/badWords";

export const dynamic = "force-dynamic";

// Комментарий к фото/видео. Пишется только через сервер: здесь проверка запрещённых слов.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "comments/send", 20, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const postId = String(b.postId ?? "");
  const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!postId || !text) return bad("empty");
  if (hasBadWords(text)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });

  const { data: u } = await supabaseAdmin.from("users").select("is_banned").eq("id", uid).maybeSingle();
  if (!u || (u as any).is_banned) return bad("forbidden", 403);
  const { data: post } = await supabaseAdmin.from("content_posts").select("id").eq("id", postId).maybeSingle();
  if (!post) return bad("not_found", 404);

  const { error } = await supabaseAdmin.from("media_comments").insert({ post_id: postId, user_id: uid, body: text });
  if (error) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
