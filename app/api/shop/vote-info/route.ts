import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Сколько у человека голосов: бесплатных и купленных.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("phone_verified")
    .eq("id", uid)
    .maybeSingle();
  const { data: set } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "free_votes_total")
    .maybeSingle();
  const total = Number.isFinite(Number(set?.value)) && set?.value !== "" && set?.value != null ? Number(set.value) : 3;

  const { data: usage } = await supabaseAdmin
    .from("free_vote_usage")
    .select("used_count")
    .eq("user_id", uid)
    .maybeSingle();
  const { data: credits } = await supabaseAdmin
    .from("vote_credits")
    .select("balance")
    .eq("user_id", uid)
    .maybeSingle();

  const verified = !!me?.phone_verified;
  return NextResponse.json({
    ok: true,
    verified,
    free_total: total,
    free_left: verified ? Math.max(0, total - (usage?.used_count ?? 0)) : 0,
    balance: credits?.balance ?? 0,
  });
}
