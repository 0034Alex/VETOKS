import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { kyivIsSunday, kyivWeekStart } from "@/lib/kyiv";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Чёрная метка: только в воскресенье (Киев), одна в неделю, только участнице своего региона.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "black-marks/send", 10, 3600, uid);
  if (rl) return rl;

  const body = await req.json().catch(() => ({}));
  const targetId = String(body.targetId || "");
  if (!targetId) return bad("bad_request");

  if (!kyivIsSunday()) return bad("not_sunday", 403);

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("phone_verified")
    .eq("id", uid)
    .maybeSingle();
  if (!me?.phone_verified) return bad("need_verify", 403);

  const { data: mine } = await supabaseAdmin
    .from("participants")
    .select("id, region_id, is_eliminated, age_category")
    .eq("user_id", uid)
    .maybeSingle();
  if (!mine || mine.is_eliminated) return bad("not_participant", 403);
  if (!mine.region_id) return bad("no_region", 400);
  // Для категории TEEN чёрных меток нет.
  if (mine.age_category === "teen") return bad("teen_off", 403);
  if (mine.id === targetId) return bad("self", 400);

  const { data: target } = await supabaseAdmin
    .from("participants")
    .select("id, region_id, is_eliminated, age_category")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.is_eliminated) return bad("no_target", 404);
  if (target.region_id !== mine.region_id) return bad("other_region", 403);
  if ((target.age_category ?? "main") !== (mine.age_category ?? "main")) return bad("other_category", 403);

  const weekStart = kyivWeekStart();
  const { data: already } = await supabaseAdmin
    .from("black_marks")
    .select("id")
    .eq("sender_participant_id", mine.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (already) return bad("already_sent", 409);

  const { error } = await supabaseAdmin.from("black_marks").insert({
    sender_participant_id: mine.id,
    target_participant_id: targetId,
    region_id: mine.region_id,
    week_start: weekStart,
  });
  if (error) return bad(error.code === "23505" ? "already_sent" : "server", error.code === "23505" ? 409 : 500);
  return NextResponse.json({ ok: true });
}
