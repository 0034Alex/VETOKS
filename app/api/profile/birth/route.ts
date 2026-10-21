import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { checkBirthForSignup } from "@/lib/ageServer";
import { logSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";

// Дата рождения для тех, кто регистрировался до введения возрастных категорий.
// Записывается один раз; дальше менять можно только через поддержку (CRM).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "birth", 10, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  const { data: u } = await supabaseAdmin.from("users").select("birth_date").eq("id", uid).maybeSingle();
  if (!u) return bad("no_user", 404);
  if ((u as any).birth_date) return NextResponse.json({ ok: true, already: true });

  const c = await checkBirthForSignup(b.birth_date);
  if (!c.ok) return NextResponse.json({ ok: false, error: c.error, message: c.message }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("users")
    .update({ birth_date: c.birth, age_category: c.category })
    .eq("id", uid)
    .is("birth_date", null);
  if (error) return bad("failed", 500);
  try {
    await logSecurity("birth_set", { category: c.category }, { req, userId: uid });
  } catch {}
  return NextResponse.json({ ok: true, category: c.category });
}
