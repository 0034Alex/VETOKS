import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, participantOwner, pay, requireUser } from "@/lib/shopServer";
import { getAppPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = {
  casting: "Отбор",
  week2: "Неделя 2",
  week3: "Неделя 3",
  week4: "Неделя 4",
  week5: "Неделя 5",
  grand_final: "Гранд-финал",
};

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const cardId = String(body.cardId || "");
  if (!cardId) return bad("bad_request");

  const p = await getAppPrice("collectible_card");
  if (!p || p.price < 1) return bad("no_price", 500);

  // Сначала «занимаем» карточку: два покупателя не купят одну и ту же.
  const { data: claimed } = await supabaseAdmin
    .from("collectible_cards")
    .update({ status: "sold", buyer_id: uid, sold_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("status", "ready")
    .select("id, stage, participant_id")
    .maybeSingle();
  if (!claimed) return bad("sold", 409);

  const res = await pay(uid, p.price, "gift_sent", claimed.participant_id, p.share, {
    kind: "collectible_card",
    stage: claimed.stage,
  });
  if (!res.ok) {
    await supabaseAdmin
      .from("collectible_cards")
      .update({ status: "ready", buyer_id: null, sold_at: null })
      .eq("id", cardId);
    return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance });
  }

  const owner = await participantOwner(claimed.participant_id);
  if (owner) {
    await notify(
      owner.user_id,
      `🃏 Продана карточка «${STAGE_LABELS[claimed.stage] ?? claimed.stage}» за ${p.price.toLocaleString("ru-RU")} ₴`,
      `/my-cards`
    );
  }
  return NextResponse.json({ ok: true, balance: res.balance, stage: claimed.stage });
}
