import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const REASONS = ["spam", "nudity", "violence", "hate", "scam", "fake", "minor", "illegal", "selfharm", "ip", "other"];

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "reports/create", 10, 3600, uid);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  const postId = String(body.postId ?? "");
  const reason = REASONS.includes(body.reason) ? body.reason : "other";
  const details = String(body.details ?? "").slice(0, 500);
  if (!postId) return bad("no_post");

  const { data: post } = await supabaseAdmin
    .from("content_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return bad("no_post", 404);

  const { error } = await supabaseAdmin
    .from("content_reports")
    .insert({ post_id: postId, reporter_id: uid, reason, details });
  if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);
  // Три разных жалобы: публикация скрывается до проверки модератором.
  const { data: reps } = await supabaseAdmin.from("content_reports").select("reporter_id").eq("post_id", postId).eq("status", "open").limit(50);
  if (new Set((reps ?? []).map((r: any) => r.reporter_id)).size >= 3) {
    await supabaseAdmin.from("content_posts").update({ mod_status: "pending", mod_reason: "auto: 3 жалобы" }).eq("id", postId).eq("mod_status", "ok");
  }
  return NextResponse.json({ ok: true });
}
