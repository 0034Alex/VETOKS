import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfRegion } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

const LOCK_DAYS = 42; // раз в сезон = 6 недель

// Смена региона: не чаще одного раза в сезон (42 дня).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const regionId = String(body.regionId || "");
  if (!regionId) return bad("bad_request");

  const { data: reg } = await supabaseAdmin.from("regions").select("id, country_id").eq("id", regionId).maybeSingle();
  if (!reg) return bad("no_region", 404);

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("region_id, region_changed_at")
    .eq("id", uid)
    .maybeSingle();
  if (!u) return bad("auth", 401);
  if (u.region_id === regionId) {
    await supabaseAdmin.from("users").update({ region_pending: false }).eq("id", uid);
    return NextResponse.json({ ok: true, unchanged: true });
  }
  // Страну человек сам не меняет — это делает персонал из CRM. Регион — только внутри своей страны.
  if (u.region_id) {
    const cur = await countryOfRegion(u.region_id as string);
    if (cur && reg.country_id !== cur) return bad("other_country", 403);
  }

  if (u.region_changed_at) {
    const unlock = new Date(u.region_changed_at).getTime() + LOCK_DAYS * 86400000;
    if (Date.now() < unlock) {
      return bad("locked", 409, { until: new Date(unlock).toISOString() });
    }
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ region_id: regionId, region_changed_at: new Date().toISOString(), region_pending: false })
    .eq("id", uid);
  if (error) return bad("server", 500, { detail: error.message });
  // Анкета участницы переезжает вместе с человеком — иначе она остаётся в старом регионе.
  await supabaseAdmin.from("participants").update({ region_id: regionId }).eq("user_id", uid);
  return NextResponse.json({ ok: true });
}
