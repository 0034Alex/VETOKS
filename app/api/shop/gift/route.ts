import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blockOtherCountry, bad, fanEvent, notify, participantOwner, pay, refund, requireUser } from "@/lib/shopServer";
import { getUsdRate, giftUahPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const giftId = String(body.giftId || "");
  const participantId = String(body.participantId || "");
  const qty = Math.floor(Number(body.qty) || 1);
  if (!giftId || !participantId || qty < 1 || qty > 99) return bad("bad_request");
  const oc = await blockOtherCountry(uid, participantId);
  if (oc) return oc;


  const owner = await participantOwner(participantId);
  if (!owner) return bad("no_participant", 404);

  const { data: gift } = await supabaseAdmin
    .from("gift_catalog")
    .select("id, name, price, usd_price, participant_share_percent, is_active")
    .eq("id", giftId)
    .maybeSingle();
  if (!gift || !gift.is_active) return bad("no_gift", 404);

  const rate = await getUsdRate();
  const unit = giftUahPrice(gift, rate);
  const total = unit * qty;
  const share = Number(gift.participant_share_percent) || 0;

  const res = await pay(uid, total, "gift_sent", participantId, share, {
    kind: "gift",
    gift: gift.name,
    qty,
  });
  if (!res.ok) return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance, detail: (res as any).detail });

  const { error } = await supabaseAdmin.from("gifts").insert({
    sender_id: uid,
    participant_id: participantId,
    gift_catalog_id: gift.id,
    quantity: qty,
    total_price: total,
    participant_earning: res.earning,
    wallet_transaction_id: res.tx_id,
  });
  if (error) {
    await refund(uid, total, participantId, res.earning);
    return bad("server", 500, { detail: error.message });
  }

  await fanEvent(uid, participantId, owner.display_name, "gift", `${gift.name}${qty > 1 ? ` ×${qty}` : ""}`, total);
  await notify(
    owner.user_id,
    `🎁 Вам подарили ${gift.name}${qty > 1 ? ` ×${qty}` : ""}`,
    `/participant/${participantId}/gifts`,
    "gifts"
  );
  return NextResponse.json({ ok: true, balance: res.balance });
}
