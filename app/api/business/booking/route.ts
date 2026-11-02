import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { bookingReady, loadCatalog, freeSlots, mastersFor, ruDate, validDate } from "@/lib/bookingServer";
import { stage1Ready, notifyShop, logAct } from "@/lib/orderFlow";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

// Запись клиента: свободное время и сама запись. Мастер и услуга выбираются заранее.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "");
  if (!(await bookingReady())) return bad("need_sql", 503);

  const { data: bp0 } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, country_id, is_active, is_hidden").eq("id", s(b.businessId, 60)).maybeSingle();
  const bp: any = bp0;
  if (!bp || !bp.is_active || bp.is_hidden) return bad("not_found", 404);
  if (bp.country_id) {
    const cid = await countryOfUser(uid);
    if (cid && cid !== bp.country_id) return bad("not_found", 404);
  }

  if (a === "prefill") {
    const { data: sp } = await supabaseAdmin.from("shop_delivery_profiles").select("full_name, phone").eq("user_id", uid).maybeSingle();
    return NextResponse.json({ ok: true, name: (sp as any)?.full_name ?? "", phone: (sp as any)?.phone ?? "" });
  }

  const cat = await loadCatalog(bp.id, true);
  const service = cat.services.find((x) => x.id === s(b.serviceId, 60));
  if (!service) return bad("no_service", 404);
  const masterId = s(b.masterId, 60);
  if (masterId && !mastersFor(service, cat.masters).some((m) => m.id === masterId)) return bad("no_master", 404);
  const date = s(b.date, 10);
  if (!validDate(date)) return bad("bad_date");

  if (a === "slots") {
    const slots = await freeSlots(bp.id, service, cat.masters, masterId, date);
    return NextResponse.json({ ok: true, slots });
  }

  if (a === "book") {
    const rl = await rateLimit(req, "business/book", 15, 3600, uid);
    if (rl) return rl;
    if (bp.user_id === uid) return bad("own_business");
    const name = s(b.name, 80);
    const phone = s(b.phone, 40);
    if (!name) return bad("need_name");
    if (!phone) return bad("need_phone");
    const time = s(b.time, 5);
    const slots = await freeSlots(bp.id, service, cat.masters, masterId, date);
    const slot = slots.find((x) => x.time === time);
    if (!slot) return bad("slot_taken", 409);

    const row: Record<string, any> = {
      business_id: bp.id,
      buyer_id: uid,
      kind: "book",
      product_id: null,
      product_name: service.name,
      sku: null,
      size: null,
      qty: 1,
      unit_price: service.price,
      discount_percent: 0,
      total: service.price,
      promo_code: null,
      note: s(b.note, 500) || null,
      when_text: `${ruDate(date)} в ${time}`,
      phone,
      master_id: slot.masterId,
      master_name: slot.masterName,
      service_id: service.id,
      slot_date: date,
      slot_time: time,
      duration_min: service.duration_min,
    };
    const withName = await stage1Ready();
    if (withName) row.ship_name = name;
    else row.note = `Клиент: ${name}.${row.note ? " " + row.note : ""}`;
    const { data: created, error } = await supabaseAdmin.from("business_orders").insert(row).select("id").maybeSingle();
    if (error || !created) return bad("failed", 500);
    const newId = String((created as any).id);

    // Запоминаем имя и телефон, чтобы в следующий раз не вводить заново.
    const { data: sp } = await supabaseAdmin.from("shop_delivery_profiles").select("user_id").eq("user_id", uid).maybeSingle();
    if (!sp) await supabaseAdmin.from("shop_delivery_profiles").insert({ user_id: uid, full_name: name, phone, updated_at: new Date().toISOString() });

    await logAct(newId, bp.id, "buyer", "Покупатель", "created");
    await notifyShop(
      { id: bp.id, user_id: bp.user_id },
      `📅 Новая запись: ${service.name}, ${ruDate(date)} в ${time}, мастер ${slot.masterName}. Откройте «Заказы».`,
      `/business?tab=orders&o=${newId}`,
      { id: newId, kind: "book", status: "new", buyer_id: uid, product_name: service.name, qty: 1, total: service.price, phone, when_text: `${ruDate(date)} в ${time}`, master_name: slot.masterName, ship_name: name, note: row.note, items: null }
    );
    return NextResponse.json({ ok: true, id: newId, when: `${ruDate(date)} в ${time}`, master: slot.masterName });
  }

  return bad("bad_action");
}
