import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { getRefSettings } from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data: me } = await supabaseAdmin.from("users").select("referral_code, nick").eq("id", uid).maybeSingle();
  const { data: rows } = await supabaseAdmin
    .from("referrals")
    .select("referred_id, status, reward_referrer, created_at, users:referred_id(first_name)")
    .eq("referrer_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = (rows ?? []).map((r: any) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return { name: u?.first_name ?? "Гость", status: r.status, reward: Number(r.reward_referrer), created_at: r.created_at };
  });
  const s = await getRefSettings();
  return NextResponse.json({
    ok: true,
    code: me?.referral_code ?? "",
    nick: (me as any)?.nick ?? null,
    enabled: s.enabled,
    rewardReferrer: s.rewardReferrer,
    rewardInvited: s.rewardInvited,
    invited: list.length,
    qualified: list.filter((x) => x.status === "qualified").length,
    earned: list.reduce((a, x) => a + x.reward, 0),
    list,
  });
}
