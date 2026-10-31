import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const REASONS = ["not_shipped", "not_as_described", "fraud", "no_refund", "rude", "price_changed", "fake_goods", "false_info", "spam", "other", "nudity", "violence", "hate", "scam", "fake", "minor", "illegal", "selfharm", "ip"];

// Жалоба на страницу партнёра. Страница не скрывается сама: решает владелец VETOKS в CRM.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "business/report", 10, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return bad("no_id");
  const reason = REASONS.includes(b.reason) ? b.reason : "other";
  const { data: p } = await supabaseAdmin.from("business_profiles").select("id").eq("id", id).maybeSingle();
  if (!p) return bad("not_found", 404);
  const { error } = await supabaseAdmin
    .from("business_reports")
    .insert({ business_id: id, reporter_id: uid, reason, details: String(b.details ?? "").slice(0, 500) });
  if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
