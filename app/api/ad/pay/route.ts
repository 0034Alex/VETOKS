import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, pay, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { isSeatCat, slotFree } from "@/lib/adServer";

export const dynamic = "force-dynamic";

// Оплата одобренной заявки с баланса. Реклама запускается после оплаты.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "ad/pay", 10, 600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.requestId ?? "");
  if (!id) return bad("bad_request");

  // Берём заявку под замок: только одобренная и только своя.
  const { data: locked } = await supabaseAdmin
    .from("ad_slot_requests")
    .update({ status: "paying" })
    .eq("id", id)
    .eq("user_id", uid)
    .eq("status", "approved")
    .select("id, slot_id, name, phone, email, price")
    .maybeSingle();
  if (!locked) return bad("not_approved", 409);
  const release = () => supabaseAdmin.from("ad_slot_requests").update({ status: "approved" }).eq("id", id);

  const { data: slot } = await supabaseAdmin
    .from("ad_slots")
    .select("id, title, category, status, capacity, sold_count")
    .eq("id", locked.slot_id)
    .maybeSingle();
  if (!slot || !slotFree(slot)) {
    await release();
    return bad("slot_full", 409);
  }
  const price = Number((locked as any).price);
  if (!(price > 0)) {
    await release();
    return bad("no_price", 500);
  }

  const res = await pay(uid, price, "ad_purchase", null, 0, { kind: "ad_slot", slot: slot.id, request: id });
  if (!res.ok) {
    await release();
    return bad(res.error, res.error === "not_enough" ? 402 : res.error === "need_parent" ? 403 : 500, { balance: (res as any).balance });
  }

  // Место закрепляем за покупателем.
  await supabaseAdmin.from("ad_slot_purchases").insert({ slot_id: slot.id, owner_user_id: uid });
  if (isSeatCat(String(slot.category))) {
    await supabaseAdmin.from("ad_slots").update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", slot.id);
  } else {
    await supabaseAdmin.from("ad_slots").update({ sold_count: Number(slot.sold_count) + 1 }).eq("id", slot.id);
  }
  await supabaseAdmin.from("ad_slot_requests").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);

  // Кабинет партнёра открываем автоматически и записываем платёж.
  const { data: sp } = await supabaseAdmin.from("sponsors").select("id").eq("user_id", uid).maybeSingle();
  let sponsorId = (sp as any)?.id as string | undefined;
  if (!sponsorId) {
    const { data: ins } = await supabaseAdmin
      .from("sponsors")
      .insert({
        name: locked.name,
        status: "approved",
        stage: "paid",
        user_id: uid,
        country_id: await countryOfUser(uid),
        contact_info: { phone: locked.phone, email: (locked as any).email },
      })
      .select("id")
      .single();
    sponsorId = (ins as any)?.id;
  } else {
    await supabaseAdmin.from("sponsors").update({ status: "approved" }).eq("id", sponsorId);
  }
  if (sponsorId) {
    await supabaseAdmin.from("sponsor_payments").insert({ sponsor_id: sponsorId, amount: price, note: `Реклама в приложении: ${slot.title}` });
    const { data: all } = await supabaseAdmin.from("sponsor_payments").select("amount").eq("sponsor_id", sponsorId);
    const total = (all ?? []).reduce((t: number, p: any) => t + Number(p.amount), 0);
    await supabaseAdmin.from("sponsors").update({ amount: total }).eq("id", sponsorId);
  }
  await notify(uid, `✅ Оплата получена. Ваше рекламное место «${slot.title}» закреплено. Материалы можно загрузить в «Кабинете партнёра».`, "/partner-cabinet", "other");
  return NextResponse.json({ ok: true, balance: (res as any).balance });
}
