import { NextResponse } from "next/server";
import { countryOfUser } from "@/lib/countryServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sameCountry } from "@/lib/countryServer";
import { bad, fanEvent, notify, pay, refund, requireUser } from "@/lib/shopServer";
import { applyGiftOverrides, getUsdRate, giftUahPrice } from "@/lib/pricing";
import { blockState, findThread, pairOrder, recipientFollowsSender } from "@/lib/dmServer";
import { chatGiftEmoji } from "@/lib/chatGifts";

export const dynamic = "force-dynamic";

// Подарок прямо в чате. Деньги: списываем у дарящего, долю (по CRM) получает адресат.
// Если адресат — участница, подарок идёт ещё и в её рейтинг (таблица gifts).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const b = await req.json().catch(() => ({}));
  const to = String(b.toUserId || "");
  const giftId = String(b.giftId || "");
  const qty = Math.floor(Number(b.qty) || 1);
  if (!to || to === uid || !giftId || qty < 1 || qty > 20) return bad("bad_request");

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, first_name, privacy, is_banned")
    .eq("id", to)
    .maybeSingle();
  if (!target || target.is_banned) return bad("no_user", 404);
  if (!(await sameCountry(uid, to))) return bad("no_user", 404);
  if ((target.privacy as any)?.dm === false) return bad("dm_closed", 403);

  const bs = await blockState(uid, to);
  if (bs.blockedByMe) return bad("you_blocked", 403);
  if (bs.blockedMe) return bad("cant_send", 403);

  let thread = await findThread(uid, to);
  if (!thread) {
    // Подарок можно сделать и до первого сообщения — чат создаётся сам.
    const auto = await recipientFollowsSender(to, uid);
    const [x, y] = pairOrder(uid, to);
    const { data: created } = await supabaseAdmin
      .from("dm_threads")
      .insert({ user_a: x, user_b: y, initiator: uid, accepted: auto })
      .select("id, user_a, user_b, initiator, accepted, last_message, last_at")
      .single();
    if (!created) return bad("server", 500);
    thread = created as any;
  } else if (!thread.accepted && thread.initiator !== uid) {
    return bad("need_chat", 403);
  }
  if (!thread) return bad("server", 500);

  const { data: giftRaw } = await supabaseAdmin
    .from("gift_catalog")
    .select("id, name, price, usd_price, participant_share_percent, is_active, chat_only")
    .eq("id", giftId)
    .maybeSingle();
  const cid = await countryOfUser(uid);
  const gift = giftRaw ? (await applyGiftOverrides([giftRaw as any], cid))[0] : null;
  if (!gift || !gift.is_active || !gift.chat_only) return bad("no_gift", 404);

  const rate = await getUsdRate(cid);
  const total = giftUahPrice(gift as any, rate) * qty;
  const share = Number(gift.participant_share_percent) || 0;

  // Адресат — участница текущего шоу?
  const { data: part } = await supabaseAdmin
    .from("participants")
    .select("id, display_name")
    .eq("user_id", to)
    .eq("is_eliminated", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = { kind: "chat_gift", gift: gift.name, qty, to };
  let earning = 0;
  let txId: string | null = null;
  let balance = 0;

  if (part) {
    const res = await pay(uid, total, "gift_sent", part.id as string, share, meta);
    if (!res.ok) return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance });
    earning = res.earning;
    txId = res.tx_id;
    balance = res.balance;
    const { error } = await supabaseAdmin.from("gifts").insert({
      sender_id: uid,
      participant_id: part.id,
      gift_catalog_id: gift.id,
      quantity: qty,
      total_price: total,
      participant_earning: earning,
      wallet_transaction_id: txId,
    });
    if (error) {
      await refund(uid, total, part.id as string, earning);
      return bad("server", 500, { detail: error.message });
    }
    await fanEvent(uid, part.id as string, part.display_name as string, "gift", `${gift.name}${qty > 1 ? ` ×${qty}` : ""}`, total);
  } else {
    const res = await pay(uid, total, "gift_sent", null, 0, meta);
    if (!res.ok) return bad(res.error, res.error === "not_enough" ? 402 : 500, { balance: res.balance });
    txId = res.tx_id;
    balance = res.balance;
    earning = Math.round((total * share) / 100 * 100) / 100;
    if (earning > 0) {
      const { error } = await supabaseAdmin.rpc("vt_credit", {
        p_user: to,
        p_amount: earning,
        p_type: "gift_received",
        p_meta: meta,
      });
      if (error) {
        await refund(uid, total, null, 0);
        return bad("server", 500, { detail: error.message });
      }
    }
  }

  // Запись для «красивого жеста» в профиле адресата.
  await supabaseAdmin.from("user_gifts").insert({
    sender_id: uid,
    recipient_id: to,
    gift_catalog_id: gift.id,
    gift_name: gift.name,
    quantity: qty,
    total_price: total,
    earning,
  });

  const text = `${chatGiftEmoji(gift.name as string)} ${gift.name}${qty > 1 ? ` ×${qty}` : ""}`;
  await supabaseAdmin.from("dm_messages").insert({
    thread_id: thread.id,
    sender_id: uid,
    body: text,
    kind: "gift",
    meta: { giftId: gift.id, name: gift.name, qty },
  });
  await supabaseAdmin.from("dm_threads").update({ last_message: text, last_at: new Date().toISOString() }).eq("id", thread.id);

  const { data: me } = await supabaseAdmin.from("users").select("first_name").eq("id", uid).maybeSingle();
  await notify(to, `🎁 ${(me?.first_name as string) || "Гость"} подарил(а) вам ${text}`, `/chats/${uid}`, "gifts");

  return NextResponse.json({ ok: true, balance });
}
