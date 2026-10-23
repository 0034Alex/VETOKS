import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { notify } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { currencyOf, slotFree, slotPrice } from "@/lib/adServer";
import { updateLive } from "@/lib/adPublish";

export const dynamic = "force-dynamic";

// CRM → заявки на рекламу: одобрить (человек получает цену и платит) или отклонить с причиной.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  const note = String(b.note ?? "").trim().slice(0, 500);
  const act = b.action;
  if (!["approve", "reject", "approve_edit", "reject_edit", "extend"].includes(act)) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: r } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id, user_id, status, slot_id, first_decided_at, pending_edit, live_table, live_id, name, link_url, ad_text, image_url, ad_slots(title, category, status, capacity, sold_count, full_price, presale_price, presale_until)")
    .eq("id", id)
    .maybeSingle();
  if (!r) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!r.user_id) return NextResponse.json({ ok: false, error: "no_user" }, { status: 400 });
  const sl: any = Array.isArray((r as any).ad_slots) ? (r as any).ad_slots[0] : (r as any).ad_slots;
  const userId = String(r.user_id);

  if (act === "extend") {
    if (r.status !== "approved") return NextResponse.json({ ok: false, error: "nothing" }, { status: 409 });
    await supabaseAdmin.from("ad_slot_requests").update({ first_decided_at: new Date().toISOString() }).eq("id", id);
    await logAction(uid, "ad_request_extend", userId, { request: id });
    await notify(userId, `Срок оплаты рекламы «${sl?.title ?? ""}» продлён ещё на 24 часа.`, "/partner-cabinet", "other");
    return NextResponse.json({ ok: true });
  }

  // Правка уже работающей рекламы: одобрили — обновляем на месте, отклонили — остаётся старая версия.
  if (act === "approve_edit" || act === "reject_edit") {
    const pe: any = (r as any).pending_edit;
    if (!pe || r.status !== "paid") return NextResponse.json({ ok: false, error: "nothing" }, { status: 409 });
    if (act === "approve_edit") {
      const upd = { name: pe.name, link_url: pe.link_url, ad_text: pe.ad_text, message: pe.message, image_url: pe.image_url };
      await supabaseAdmin.from("ad_slot_requests").update({ ...upd, pending_edit: null, edit_kind: null }).eq("id", id);
      await updateLive({ live_table: (r as any).live_table, live_id: (r as any).live_id, name: upd.name, link_url: upd.link_url, ad_text: upd.ad_text, image_url: upd.image_url });
      await logAction(uid, "ad_edit_approve", userId, { request: id });
      await notify(userId, `✅ Правки вашей рекламы «${sl?.title ?? ""}» одобрены и уже в эфире.`, "/partner-cabinet", "other");
    } else {
      await supabaseAdmin.from("ad_slot_requests").update({ pending_edit: null, edit_kind: null }).eq("id", id);
      await logAction(uid, "ad_edit_reject", userId, { request: id });
      await notify(userId, `Правки рекламы «${sl?.title ?? ""}» не одобрены, в эфире осталась прежняя версия.${note ? " Причина: " + note : ""}`, "/partner-cabinet", "other");
    }
    return NextResponse.json({ ok: true });
  }

  if (act === "reject") {
    await supabaseAdmin.from("ad_slot_requests").update({ status: "rejected", decision_note: note || null, decided_at: new Date().toISOString() }).eq("id", id);
    await logAction(uid, "ad_request_reject", userId, { request: id });
    await notify(userId, `К сожалению, заявка на рекламу «${sl?.title ?? ""}» не одобрена.${note ? " Причина: " + note : ""}`, "/ad-space", "other");
    return NextResponse.json({ ok: true });
  }

  if (!sl || !slotFree(sl)) return NextResponse.json({ ok: false, error: "slot_full" }, { status: 409 });
  const price = slotPrice(sl);
  await supabaseAdmin.from("ad_slot_requests").update({ status: "approved", price, decision_note: note || null, decided_at: new Date().toISOString(), first_decided_at: (r as any).first_decided_at ?? new Date().toISOString(), edit_kind: null }).eq("id", id);
  await logAction(uid, "ad_request_approve", userId, { request: id, price });
  const cur = await currencyOf(await countryOfUser(userId));
  await notify(
    userId,
    `✅ Заявка на рекламу «${sl.title}» одобрена! К оплате ${Math.round(price)} ${cur}. Откройте Рекламный кабинет → «Мои заявки» и нажмите «Оплатить».`,
    "/ad-space",
    "other"
  );
  return NextResponse.json({ ok: true, price });
}
