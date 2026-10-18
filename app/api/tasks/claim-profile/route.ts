import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PROFILE_TASK_REWARD = 100;

// «Заполните профиль» — награда один раз, только если фото и описание есть.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "tasks/claim-profile", 10, 600, uid);
  if (rl) return rl;

  const { data: p } = await supabaseAdmin
    .from("participants")
    .select("bio, photo_url")
    .eq("user_id", uid)
    .maybeSingle();
  if (!p) return bad("not_participant", 403);
  if (!p.bio || !p.photo_url) return bad("profile_incomplete");

  const { data, error } = await supabaseAdmin.rpc("vt_claim_profile_reward", {
    p_user: uid,
    p_amount: PROFILE_TASK_REWARD,
  });
  if (error || !data) return bad("failed", 500);
  if (!(data as any).ok) return bad((data as any).error ?? "failed");
  return NextResponse.json({ ok: true, reward: PROFILE_TASK_REWARD });
}
