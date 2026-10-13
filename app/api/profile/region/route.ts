import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

const LOCK_DAYS = 42; // раз в сезон = 6 недель

// Смена региона: не чаще одного раза в сезон (42 дня).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const regionId = String(body.regionId || "");
  if (!regionId) return bad("bad_request");

  const { data: reg } = await supabaseAdmin.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (!reg) return bad("no_region", 404);

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("region_id, region_changed_at")
    .eq("id", uid)
    .maybeSingle();
  if (!u) return bad("auth", 401);
  if (u.region_id === regionId) return NextResponse.json({ ok: true, unchanged: true });

  if (u.region_changed_at) {
    const unlock = new Date(u.region_changed_at).getTime() + LOCK_DAYS * 86400000;
    if (Date.now() < unlock) {
      return bad("locked", 409, { until: new Date(unlock).toISOString() });
    }
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ region_id: regionId, region_changed_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) return bad("server", 500, { detail: error.message });
  return NextResponse.json({ ok: true });
}
