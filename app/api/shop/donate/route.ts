import { NextResponse } from "next/server";
import { countryOfUser } from "@/lib/countryServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blockOtherCountry, bad, kyivWeekStart, notify, fanEvent, participantOwner, pay, refund, requireUser } from "@/lib/shopServer";
import { getShare } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Донат на цель недели.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const participantId = String(body.participantId || "");
  const amount = Math.floor(Number(body.amount));
  if (!participantId || !amount || amount < 10 || amount > 100000) return bad("bad_request");
  const oc = await blockOtherCountry(uid, participantId);
  if (oc) return oc;


  const owner = await participantOwner(participantId);
  if (!owner) return bad("no_participant", 404);

  const share = await getShare("weekly_goal", await countryOfUser(uid));
  const res = await pay(uid, amount, "gift_sent", participantId, share, { kind: "weekly_goal" });
  if (!res.ok) return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance });

  const { error } = await supabaseAdmin.from("weekly_goal_contributions").insert({
    participant_id: participantId,
    user_id: uid,
    amount,
    week_start: kyivWeekStart(),
  });
  if (error) {
    await refund(uid, amount, participantId, res.earning);
    return bad("server", 500);
  }

  await fanEvent(uid, participantId, owner.display_name, "donate", `Донат ${amount} ₴`, amount);
  await notify(owner.user_id, `💝 Вам задонатили ${amount} ₴ на цель недели`, `/participant/${participantId}`, "gifts");
  return NextResponse.json({ ok: true, balance: res.balance });
}
