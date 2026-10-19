import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const REASONS = ["spam", "nudity", "violence", "hate", "scam", "fake", "minor", "illegal", "selfharm", "ip", "other"];

// Жалоба на комментарий. Модератор видит её в CRM → Жалобы.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "comments/report", 15, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const commentId = String(b.commentId ?? "");
  const reason = REASONS.includes(b.reason) ? b.reason : "other";
  const details = String(b.details ?? "").slice(0, 500);
  if (!commentId) return bad("no_comment");

  const { data: c } = await supabaseAdmin.from("media_comments").select("id, user_id").eq("id", commentId).maybeSingle();
  if (!c) return bad("no_comment", 404);
  if ((c as any).user_id === uid) return bad("own", 400);

  const { error } = await supabaseAdmin
    .from("comment_reports")
    .insert({ comment_id: commentId, reporter_id: uid, reason, details });
  if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);

  // 3 разных человека пожаловались — комментарий удаляется сам (как посты), жалобы закрываются.
  const { data: open } = await supabaseAdmin.from("comment_reports").select("reporter_id").eq("comment_id", commentId).eq("status", "open");
  const distinct = new Set(((open ?? []) as any[]).map((r) => r.reporter_id));
  if (distinct.size >= 3) {
    await supabaseAdmin.from("media_comments").delete().eq("id", commentId);
    await supabaseAdmin
      .from("comment_reports")
      .update({ status: "deleted", resolved_at: new Date().toISOString() })
      .eq("comment_id", commentId)
      .eq("status", "open");
    await supabaseAdmin.from("notifications").insert({
      user_id: (c as any).user_id,
      message: "Ваш комментарий удалён: на него пришло несколько жалоб.",
    });
    return NextResponse.json({ ok: true, removed: true });
  }
  return NextResponse.json({ ok: true });
}
