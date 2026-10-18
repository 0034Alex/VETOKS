import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { getRefSettings } from "@/lib/referral";
import { countryOfUser } from "@/lib/countryServer";
import { BOT_USERNAME } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data: me } = await supabaseAdmin.from("users").select("referral_code, nick, referred_by, created_at").eq("id", uid).maybeSingle();
  // Кто пригласил меня (если уже привязано) и можно ли ещё ввести код руками (первые 7 дней).
  let invitedBy: string | null = null;
  if ((me as any)?.referred_by) {
    const { data: ib } = await supabaseAdmin.from("users").select("first_name").eq("id", (me as any).referred_by).maybeSingle();
    invitedBy = (ib as any)?.first_name ?? "друг";
  }
  const canEnterCode = !(me as any)?.referred_by && Date.now() - new Date((me as any)?.created_at ?? 0).getTime() < 7 * 86400000;
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
  const s = await getRefSettings(await countryOfUser(uid));
  let commission = 0;
  const { data: w } = await supabaseAdmin.from("wallets").select("id").eq("user_id", uid).order("id").limit(1).maybeSingle();
  if (w) {
    const { data: tx } = await supabaseAdmin.from("wallet_transactions").select("amount").eq("wallet_id", (w as any).id).eq("type", "referral_commission").limit(5000);
    commission = (tx ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
  }
  return NextResponse.json({
    ok: true,
    code: me?.referral_code ?? "",
    nick: (me as any)?.nick ?? null,
    bot: BOT_USERNAME,
    invitedBy,
    canEnterCode,
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
