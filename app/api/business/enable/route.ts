import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tokenHashForUser } from "@/lib/authServer";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { businessContext, createBusinessAccount } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Включить бизнес-аккаунт: создаётся отдельный аккаунт в «семье» (занимает один из 3 слотов).
// Если он уже есть, просто отдаём вход в него.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "business/enable", 5, 3600, uid);
  if (rl) return rl;

  const c = await businessContext(uid);
  if (!c) return bad("no_user", 404);

  if (c.profile) {
    const th = await tokenHashForUser(c.profile.user_id);
    if (!th) return bad("login_failed", 500);
    return NextResponse.json({ ok: true, token_hash: th });
  }
  if (!c.sponsor) return bad("not_partner", 403);

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "auto" ? "auto" : body?.mode === "food" ? "food" : body?.mode === "book" ? "book" : "buy";
  const r = await createBusinessAccount(c.rootId, c.sponsor, { quick_action: mode === "buy" || mode === "food" ? "buy" : "book" });
  if (!r.ok) return bad(r.error, r.error === "create_failed" || r.error === "save_failed" ? 500 : 400);
  await supabaseAdmin.from("business_profiles").update({ biz_type: mode === "auto" ? "auto" : mode === "food" ? "food" : mode === "book" ? "service" : "shop" }).eq("user_id", r.userId);
  const th = await tokenHashForUser(r.userId);
  if (!th) return bad("login_failed", 500);
  return NextResponse.json({ ok: true, token_hash: th });
}
