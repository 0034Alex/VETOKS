import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { carsReady } from "@/lib/carsServer";
import { carTitle, carPrice } from "@/lib/carsShared";
import { kyivNow, dayDiff, validDate, toMin, ruDate } from "@/lib/bookingServer";
import { stage1Ready, notifyShop, logAct } from "@/lib/orderFlow";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

// Заявка на осмотр или тест-драйв конкретного автомобиля.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  if (!(await carsReady())) return bad("need_sql", 503);

  const { data: bp0 } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, country_id, is_active, is_hidden").eq("id", s(b.businessId, 60)).maybeSingle();
  const bp: any = bp0;
  if (!bp || !bp.is_active || bp.is_hidden) return bad("not_found", 404);
  if (bp.user_id === uid) return bad("own_business");
  if (bp.country_id) {
    const cid = await countryOfUser(uid);
    if (cid && cid !== bp.country_id) return bad("not_found", 404);
  }

  if (b.action === "prefill") {
    const { data: sp } = await supabaseAdmin.from("shop_delivery_profiles").select("full_name, phone").eq("user_id", uid).maybeSingle();
    return NextResponse.json({ ok: true, name: (sp as any)?.full_name ?? "", phone: (sp as any)?.phone ?? "" });
  }

  const rl = await rateLimit(req, "business/carlead", 15, 3600, uid);
  if (rl) return rl;
  const { data: car0 } = await supabaseAdmin.from("business_cars").select("*").eq("id", s(b.carId, 60)).eq("business_id", bp.id).maybeSingle();
  const car: any = car0;
  if (!car || car.is_active === false || car.status === "sold") return bad("no_car", 404);

  const name = s(b.name, 80);
  const phone = s(b.phone, 40);
  if (!name) return bad("need_name");
  if (!phone) return bad("need_phone");
  const date = s(b.date, 10);
  const time = s(b.time, 5);
  const now = kyivNow();
  const diff = validDate(date) ? dayDiff(now.date, date) : -1;
  const tm = toMin(time);
  if (diff < 0 || diff > 60 || isNaN(tm) || tm < 8 * 60 || tm > 21 * 60) return bad("bad_date");
  if (diff === 0 && tm <= now.min) return bad("bad_date");

  const title = carTitle(car);
  const when = `${ruDate(date)} в ${time}`;
  const visit = b.kind === "drive" ? "Тест-драйв" : "Осмотр";
  const row: Record<string, any> = {
    business_id: bp.id,
    buyer_id: uid,
    kind: "book",
    product_id: null,
    product_name: title,
    sku: null,
    size: null,
    qty: 1,
    unit_price: Number(car.price) || 0,
    discount_percent: 0,
    total: Number(car.price) || 0,
    promo_code: null,
    note: `${visit}. ${s(b.note, 500)}`.trim(),
    when_text: when,
    phone,
    car_id: car.id,
  };
  if (await stage1Ready()) row.ship_name = name;
  else row.note = `Клиент: ${name}. ${row.note}`;
  const { data: created, error } = await supabaseAdmin.from("business_orders").insert(row).select("id").maybeSingle();
  if (error || !created) return bad("failed", 500);
  const newId = String((created as any).id);

  const { data: sp } = await supabaseAdmin.from("shop_delivery_profiles").select("user_id").eq("user_id", uid).maybeSingle();
  if (!sp) await supabaseAdmin.from("shop_delivery_profiles").insert({ user_id: uid, full_name: name, phone, updated_at: new Date().toISOString() });

  await logAct(newId, bp.id, "buyer", "Покупатель", "created");
  await notifyShop(
    { id: bp.id, user_id: bp.user_id },
    `🚗 Заявка (${visit.toLowerCase()}): ${title}, ${carPrice(car.price, car.currency)}, ${when}. Откройте «Заказы».`,
    `/business?tab=orders&o=${newId}`,
    { id: newId, kind: "book", status: "new", buyer_id: uid, product_name: title, qty: 1, total: Number(car.price) || 0, phone, when_text: when, ship_name: name, note: row.note, items: null }
  );
  return NextResponse.json({ ok: true, id: newId, when });
}
