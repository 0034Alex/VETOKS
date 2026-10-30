import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { BIZ_COLS, syncBusinessToUser } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const url = (v: any) => {
  const t = s(v, 300);
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : "https://" + t;
};

// Партнёр правит свою страницу и включает или выключает её.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "business/save", 60, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  const { data: cur } = await supabaseAdmin.from("business_profiles").select(BIZ_COLS).eq("user_id", uid).maybeSingle();
  if (!cur) return bad("no_business", 404);

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (b.name !== undefined) {
    const n = s(b.name, 80);
    if (!n) return bad("empty_name");
    patch.name = n;
  }
  if (b.category !== undefined) patch.category = s(b.category, 60) || null;
  if (b.about !== undefined) patch.about = s(b.about, 1500) || null;
  if (b.logo_url !== undefined) patch.logo_url = s(b.logo_url, 500) || null;
  if (b.cover_url !== undefined) patch.cover_url = s(b.cover_url, 500) || null;
  if (b.hours !== undefined) patch.hours = s(b.hours, 120) || null;
  if (b.address !== undefined) patch.address = s(b.address, 200) || null;
  if (b.phone !== undefined) patch.phone = s(b.phone, 40) || null;
  if (b.email !== undefined) patch.email = s(b.email, 120) || null;
  if (b.site_url !== undefined) patch.site_url = url(b.site_url) || null;
  if (b.quick_action !== undefined) patch.quick_action = b.quick_action === "book" ? "book" : "buy";

  if (b.is_active !== undefined) {
    const want = !!b.is_active;
    if (want) {
      const merged = { ...(cur as any), ...patch };
      if (!merged.name) return bad("empty_name");
      if (!merged.phone && !merged.email) return bad("need_contact");
    }
    patch.is_active = want;
  }
  const { data, error } = await supabaseAdmin.from("business_profiles").update(patch).eq("user_id", uid).select(BIZ_COLS).maybeSingle();
  if (error) return bad("failed", 500);
  if (patch.name) await supabaseAdmin.from("users").update({ first_name: patch.name }).eq("id", uid);
  if (data) await syncBusinessToUser(uid, data);
  return NextResponse.json({ ok: true, profile: data });
}
