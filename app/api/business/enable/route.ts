import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tokenHashForUser } from "@/lib/authServer";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { autoFollowOfficial } from "@/lib/officialFollow";
import { MAX_SUB_ACCOUNTS } from "@/lib/familyServer";
import { businessContext } from "@/lib/businessServer";

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

  const { data: root } = await supabaseAdmin
    .from("users")
    .select("phone_verified, region_id, is_banned, birth_date, age_category")
    .eq("id", c.rootId)
    .maybeSingle();
  if (!root || (root as any).is_banned) return bad("banned", 403);
  if (!(root as any).phone_verified) return bad("need_phone", 400);
  if (c.members.length - 1 >= MAX_SUB_ACCOUNTS) return bad("no_slot", 400);

  const { data: created, error: ce } = await supabaseAdmin.auth.admin.createUser({
    email: `sub-${randomUUID()}@sub.vetoks.app`,
    password: randomBytes(24).toString("hex"),
    email_confirm: true,
  });
  if (ce || !created?.user) return bad("create_failed", 500);
  const newId = created.user.id;
  const name = String(c.sponsor.name || "Бизнес").slice(0, 60);

  const { error: ie } = await supabaseAdmin.from("users").insert({
    id: newId,
    first_name: name,
    region_id: (root as any).region_id,
    birth_date: (root as any).birth_date ?? null,
    age_category: (root as any).age_category ?? null,
    role: "viewer",
    parent_user_id: c.rootId,
    phone_verified: true,
    phone_verified_at: new Date().toISOString(),
    is_business: true,
  });
  if (ie) {
    await supabaseAdmin.auth.admin.deleteUser(newId);
    return bad("save_failed", 500);
  }
  const { error: pe } = await supabaseAdmin.from("business_profiles").insert({
    user_id: newId,
    sponsor_id: String(c.sponsor.id),
    country_id: c.sponsor.country_id ?? null,
    region_id: (root as any).region_id ?? null,
    name,
    verified: true, // синяя галочка сразу: партнёр уже подтверждён в CRM
  });
  if (pe) {
    await supabaseAdmin.from("users").delete().eq("id", newId);
    await supabaseAdmin.auth.admin.deleteUser(newId);
    return bad("save_failed", 500);
  }
  try {
    await autoFollowOfficial(newId, (root as any).region_id as string);
  } catch {}
  const th = await tokenHashForUser(newId);
  if (!th) return bad("login_failed", 500);
  return NextResponse.json({ ok: true, token_hash: th });
}
