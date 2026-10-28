import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { newToken } from "@/lib/authServer";
import { botForUser } from "@/lib/countryBot";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { CONSENT_VERSION } from "@/lib/parentServer";

export const dynamic = "force-dynamic";

// Согласие родителей для категории TEEN.
// action "status": есть ли согласие. action "link": ссылка в бота для родителя.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "parent/start", 20, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  const { data: u } = await supabaseAdmin.from("users").select("age_category").eq("id", uid).maybeSingle();
  if ((u as any)?.age_category !== "teen") return NextResponse.json({ ok: true, needed: false, approved: true });

  const { data: ok } = await supabaseAdmin
    .from("parental_consents")
    .select("id, agreed_at")
    .eq("user_id", uid)
    .eq("status", "approved")
    .order("agreed_at", { ascending: false })
    .limit(1);
  const approved = (ok ?? []).length > 0;

  if (b.action !== "link" || approved) {
    return NextResponse.json({ ok: true, needed: true, approved, agreedAt: (ok as any)?.[0]?.agreed_at ?? null });
  }

  const token = newToken();
  const { error } = await supabaseAdmin.from("parental_consents").insert({
    user_id: uid,
    token,
    status: "pending",
    doc_version: CONSENT_VERSION,
    expires_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
  });
  if (error) return bad("server", 500);
  return NextResponse.json({ ok: true, needed: true, approved: false, link: `https://t.me/${(await botForUser(uid)).username}?start=parent_${token}` });
}
