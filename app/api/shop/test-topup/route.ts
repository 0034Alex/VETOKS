import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser, settingsForCountry } from "@/lib/countryServer";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { parentConsentOk } from "@/lib/parentServer";
import { coinSettingsFor } from "@/lib/coinsServer";

export const dynamic = "force-dynamic";

// ТЕСТОВОЕ пополнение (без реальной оплаты). Включается/выключается в CRM (Цены → переключатель).
// {check:true} только сообщает, включено ли оно. {pack: номер} — пакет монет, {amount: сумма} — своя сумма.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "shop/test-topup", 30, 3600, uid);
  if (rl) return rl;

  const cid = await countryOfUser(uid);
  const set = await settingsForCountry(["test_topup_enabled"], cid);
  const enabled = set.test_topup_enabled !== "false";
  const body = await req.json().catch(() => ({}));
  if (body?.check) return NextResponse.json({ ok: true, enabled });
  if (!enabled) return bad("disabled", 403);
  if (!(await parentConsentOk(uid))) return bad("need_parent", 403);

  const s = await coinSettingsFor(cid);
  const { data: w } = await supabaseAdmin
    .from("wallets")
    .select("first_open_at, first_bonus_used")
    .eq("user_id", uid)
    .order("id")
    .limit(1)
    .maybeSingle();
  const until = w?.first_open_at ? new Date(w.first_open_at as string).getTime() + s.bonusDays * 86400000 : 0;
  const bonusOn = !w?.first_bonus_used && s.bonusDays > 0 && Date.now() < until;

  let coins = 1000;
  let bonus = 0;
  if (body?.pack !== undefined) {
    const p = s.packs[Number(body.pack)];
    if (!p) return bad("bad_pack");
    coins = p.coins;
    bonus = bonusOn ? p.bonus : 0;
  } else if (body?.amount !== undefined) {
    const a = Number(body.amount);
    if (!isFinite(a) || a < s.topupMin || a > s.topupMax) return bad("out_of_range", 400, { min: s.topupMin, max: s.topupMax });
    coins = Math.floor(a * s.coinsPerUnit);
    bonus = bonusOn ? Math.floor((coins * s.customBonusPct) / 100) : 0;
  }

  const { data, error } = await supabaseAdmin.rpc("vt_topup_ex", { p_user: uid, p_amount: coins, p_bonus: bonus, p_meta: { test: true } });
  if (error || !data) return bad("server", 500);
  const r = data as any;
  return NextResponse.json({ ok: true, balance: r.balance, bonus: r.bonus, coins });
}
