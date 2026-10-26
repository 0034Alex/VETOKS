import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { coinSettingsOfUser } from "@/lib/coinsServer";
import { countryOfUser } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Кошелёк человека: монеты, Короны, пакеты пополнения и бонус первой покупки (таймер идёт от первого захода сюда).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const s = await coinSettingsOfUser(uid);
  const { data: openedAt } = await supabaseAdmin.rpc("vt_wallet_open", { p_user: uid });
  const { data: w } = await supabaseAdmin
    .from("wallets")
    .select("balance, withdrawable_balance, first_open_at, first_bonus_used")
    .eq("user_id", uid)
    .order("id")
    .limit(1)
    .maybeSingle();

  const cid = await countryOfUser(uid);
  let symbol = "₴";
  if (cid) {
    const { data: c } = await supabaseAdmin.from("countries").select("currency_symbol").eq("id", cid).maybeSingle();
    symbol = ((c as any)?.currency_symbol as string) || "₴";
  }
  const { data: isP } = await supabaseAdmin.from("participants").select("id").eq("user_id", uid).limit(1);

  const start = new Date((w?.first_open_at as string) || (openedAt as string) || Date.now()).getTime();
  const until = start + s.bonusDays * 86400000;
  const bonusOn = !w?.first_bonus_used && s.bonusDays > 0 && Date.now() < until;

  return NextResponse.json({
    ok: true,
    coins: Number(w?.balance ?? 0),
    crowns: Number(w?.withdrawable_balance ?? 0),
    isParticipant: (isP ?? []).length > 0,
    symbol,
    coinsPerUnit: s.coinsPerUnit,
    packs: s.packs,
    topupMin: s.topupMin,
    topupMax: s.topupMax,
    customBonusPct: s.customBonusPct,
    bonusOn,
    bonusUntil: bonusOn ? new Date(until).toISOString() : null,
    exchangeOn: s.exchangeOn,
    coinsPerCrown: s.coinsPerCrown,
  });
}
