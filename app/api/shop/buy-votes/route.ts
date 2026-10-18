import { NextResponse } from "next/server";
import { countryOfUser } from "@/lib/countryServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, pay, refund, requireUser } from "@/lib/shopServer";
import { getAppPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Покупка пакета голосов за деньги с баланса.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const amount = Math.floor(Number(body.amount));
  if (!amount || amount < 1 || amount > 5000) return bad("bad_request");

  const p = await getAppPrice("vote", undefined, await countryOfUser(uid));
  if (!p || p.price < 1) return bad("no_price", 500);
  const total = p.price * amount;

  const res = await pay(uid, total, "vote_purchase", null, 0, {
    kind: "vote_pack",
    votes: amount,
  });
  if (!res.ok) return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance });

  const { data, error } = await supabaseAdmin.rpc("vt_add_vote_credits", {
    p_user: uid,
    p_amount: amount,
  });
  if (error) {
    await refund(uid, total, null, 0);
    return bad("server", 500);
  }
  return NextResponse.json({ ok: true, votes: data, balance: res.balance });
}
