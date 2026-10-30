import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { getRefSettings } from "@/lib/referral";
import { countryOfUser } from "@/lib/countryServer";
import { botForUser } from "@/lib/countryBot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data: me } = await supabaseAdmin.from("users").select("referral_code, nick").eq("id", uid).maybeSingle();
  const { data: rows } = await supabaseAdmin
    .from("referrals")
    .select("referred_id, status, reward_referrer, created_at")
    .eq("referrer_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = Array.from(new Set((rows ?? []).map((r: any) => r.referred_id as string)));
  const { data: us } = ids.length ? await supabaseAdmin.from("users").select("id, first_name").in("id", ids) : { data: [] as any[] };
  const nm = new Map<string, string>(((us ?? []) as any[]).map((u: any) => [u.id, u.first_name]));
  const list = (rows ?? []).map((r: any) => ({
    name: nm.get(r.referred_id) ?? "Гость",
    status: r.status,
    reward: Number(r.reward_referrer),
    created_at: r.created_at,
  }));
  const s = await getRefSettings(await countryOfUser(uid));
  let commission = 0;
  const { data: w } = await supabaseAdmin.from("wallets").select("id").eq("user_id", uid).order("id").limit(1).maybeSingle();
  if (w) {
    const { data: tx } = await supabaseAdmin.from("wallet_transactions").select("amount").eq("wallet_id", (w as any).id).eq("type", "referral_commission").limit(5000);
    commission = (tx ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
  }
  // Рекламодатели, которых привела эта участница: видны только одобренные, плюс сумма бонусов.
  const { data: myPart } = await supabaseAdmin.from("participants").select("id").eq("user_id", uid).limit(1).maybeSingle();
  const canInviteAdvertisers = !!myPart;
  let advertisers: { name: string }[] = [];
  let advEarned = 0;
  if (canInviteAdvertisers) {
    const { data: au } = await supabaseAdmin.from("users").select("id").eq("referred_by", uid).eq("is_advertiser", true).limit(300);
    const aids = ((au ?? []) as any[]).map((x) => x.id as string);
    if (aids.length) {
      const { data: sp } = await supabaseAdmin.from("sponsors").select("name").in("user_id", aids).eq("status", "approved").limit(300);
      advertisers = ((sp ?? []) as any[]).map((x) => ({ name: String(x.name ?? "") }));
    }
    if (w) {
      const { data: tx2 } = await supabaseAdmin.from("wallet_transactions").select("amount").eq("wallet_id", (w as any).id).eq("type", "advertiser_bonus").limit(5000);
      advEarned = (tx2 ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
    }
  }
  return NextResponse.json({
    ok: true,
    canInviteAdvertisers,
    advertisers,
    advEarned,
    code: me?.referral_code ?? "",
    nick: (me as any)?.nick ?? null,
    bot: (await botForUser(uid)).username,
    enabled: s.enabled,
    rewardReferrer: s.rewardReferrer,
    rewardInvited: s.rewardInvited,
    percent: s.percent,
    percentDays: s.percentDays,
    commission,
    invited: list.length,
    qualified: list.filter((x) => x.status === "qualified").length,
    earned: list.reduce((a, x) => a + x.reward, 0),
    list,
  });
}
