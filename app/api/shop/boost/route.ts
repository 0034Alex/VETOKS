import { NextResponse } from "next/server";
import { countryOfUser } from "@/lib/countryServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blockOtherCountry, bad, notify, fanEvent, participantOwner, pay, refund, requireUser } from "@/lib/shopServer";
import { getAppPrice, getUsdRate } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const BOOST_LIMIT = 3;
const BOOST_VOTES = 1000;

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const participantId = String(body.participantId || "");
  if (!participantId) return bad("bad_request");
  const oc = await blockOtherCountry(uid, participantId);
  if (oc) return oc;


  const owner = await participantOwner(participantId);
  if (!owner) return bad("no_participant", 404);

  const { count } = await supabaseAdmin
    .from("boosts")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .eq("boost_type", "rating_bump");
  if ((count ?? 0) >= BOOST_LIMIT) return bad("limit", 409);

  const p = await getAppPrice("boost", await getUsdRate(await countryOfUser(uid)));
  if (!p || p.price < 1) return bad("no_price", 500);

  const res = await pay(uid, p.price, "boost_purchase", participantId, p.share, { kind: "boost" });
  if (!res.ok) return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance });

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 7);

  const { error: boostError } = await supabaseAdmin.from("boosts").insert({
    participant_id: participantId,
    boost_type: "rating_bump",
    price: p.price,
    ends_at: endsAt.toISOString(),
    wallet_transaction_id: res.tx_id,
  });
  if (boostError) {
    await refund(uid, p.price, participantId, res.earning);
    return bad("server", 500);
  }

  // Буст = 1000 голосов, честно помеченных как купленные.
  const rows = Array.from({ length: BOOST_VOTES }, () => ({
    voter_id: uid,
    participant_id: participantId,
    weight: 1,
    is_paid: true,
  }));
  await supabaseAdmin.from("votes").insert(rows);

  await fanEvent(uid, participantId, owner.display_name, "boost", "Буст в топ", p.price);
  await notify(owner.user_id, `🚀 Ваш профиль продвинут — +${BOOST_VOTES} голосов`, `/participant/${participantId}`, "gifts");
  return NextResponse.json({ ok: true, balance: res.balance });
}
