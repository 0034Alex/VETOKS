import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { currencyOfCountry } from "@/lib/businessServer";
import { foodReady, loadDishes } from "@/lib/foodServer";
import { unitPrice, modsText, MAX_LINE_QTY } from "@/lib/foodShared";
import { stage1Ready, notifyShop, logAct } from "@/lib/orderFlow";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

// Заказ еды: одно заведение, цены считаются на сервере по меню и выбранным модификаторам.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  if (!(await foodReady())) return bad("need_sql", 503);

  const { data: bp0 } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, country_id, is_active, is_hidden").eq("id", s(b.businessId, 60)).maybeSingle();
  const bp: any = bp0;
  if (!bp || !bp.is_active || bp.is_hidden) return bad("not_found", 404);
  if (bp.country_id) {
    const cid = await countryOfUser(uid);
    if (cid && cid !== bp.country_id) return bad("not_found", 404);
  }

  if (b.action === "prefill") {
    const { data: sp } = await supabaseAdmin.from("shop_delivery_profiles").select("full_name, phone, method, point").eq("user_id", uid).maybeSingle();
    return NextResponse.json({ ok: true, name: (sp as any)?.full_name ?? "", phone: (sp as any)?.phone ?? "", address: (sp as any)?.method === "courier" ? (sp as any)?.point ?? "" : "" });
  }

  if (b.action !== "order") return bad("bad_action");
  const rl = await rateLimit(req, "business/food", 15, 3600, uid);
  if (rl) return rl;
  if (bp.user_id === uid) return bad("own_business");
  if (!(await stage1Ready())) return bad("need_sql", 503);

  const method = b.method === "pickup" ? "pickup" : "courier";
  const name = s(b.name, 80);
  const phone = s(b.phone, 40);
  const address = s(b.address, 200);
  if (!name) return bad("need_name");
  if (!phone) return bad("need_phone");
  if (method === "courier" && !address) return bad("need_address");

  const dishes = await loadDishes(bp.id, true);
  const byId: Record<string, any> = {};
  dishes.forEach((d) => (byId[d.id] = d));
  const lines: any[] = Array.isArray(b.lines) ? b.lines.slice(0, 30) : [];
  if (!lines.length) return bad("empty_cart");

  const items: any[] = [];
  for (const ln of lines) {
    const d = byId[s(ln?.dishId, 60)];
    if (!d) return bad("dish_gone");
    if (!d.in_stock) return bad("dish_out");
    const qty = Math.floor(Number(ln?.qty) || 0);
    if (qty < 1 || qty > MAX_LINE_QTY) return bad("bad_qty");
    const mods: Record<string, string[]> = {};
    for (const g of d.modifiers) {
      const picked: string[] = (Array.isArray(ln?.mods?.[g.id]) ? ln.mods[g.id] : []).map((x: any) => s(x, 60));
      const okNames = picked.filter((n) => g.options.some((o: any) => o.name === n));
      if (okNames.length !== picked.length) return bad("bad_mods");
      if (g.type === "single" && okNames.length !== 1) return bad("need_choice");
      mods[g.id] = Array.from(new Set(g.type === "single" ? okNames.slice(0, 1) : okNames));
    }
    const unit = unitPrice(d, mods);
    items.push({ dish: true, product_id: d.id, name: d.name, size: modsText(d, mods), qty, unit, line_total: Math.round(unit * qty * 100) / 100 });
  }
  const total = Math.round(items.reduce((x: number, y: any) => x + Number(y.line_total), 0) * 100) / 100;
  const qtyAll = items.reduce((x: number, y: any) => x + Number(y.qty), 0);
  const summary = items.map((i: any) => `${i.name}${i.size ? ` (${i.size})` : ""}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ").slice(0, 200);
  const change = Number(String(b.changeFrom ?? "").replace(",", "."));
  const pay = b.pay === "transfer" ? "transfer" : "cash";
  const noteParts = [pay === "transfer" ? "Оплата переводом на карту." : "Оплата при получении.", pay === "cash" && change > 0 ? `Нужна сдача с ${change}.` : "", s(b.comment, 400)].filter(Boolean);

  const { data: created, error } = await supabaseAdmin
    .from("business_orders")
    .insert({
      business_id: bp.id,
      buyer_id: uid,
      kind: "buy",
      product_id: null,
      product_name: summary,
      qty: qtyAll,
      unit_price: Number(items[0].unit),
      discount_percent: 0,
      total,
      note: noteParts.join(" "),
      phone,
      items,
      ship_name: name,
      ship_method: method,
      ship_point: method === "courier" ? address : null,
      order_type: "food",
      pay_method: pay,
    })
    .select("id")
    .maybeSingle();
  if (error || !created) return bad("failed", 500);
  const newId = String((created as any).id);

  // Запоминаем имя, телефон и адрес для следующих заказов.
  await supabaseAdmin.from("shop_delivery_profiles").upsert({ user_id: uid, full_name: name, phone, method: method === "courier" ? "courier" : "pickup", city: null, point: method === "courier" ? address : null, updated_at: new Date().toISOString() });

  await logAct(newId, bp.id, "buyer", "Покупатель", "created");
  await notifyShop(
    { id: bp.id, user_id: bp.user_id },
    `🍽 Новый заказ еды на ${total} ${await currencyOfCountry(bp.country_id)}. Откройте «Заказы».`,
    `/business?tab=orders&o=${newId}`,
    { id: newId, kind: "buy", order_type: "food", status: "new", buyer_id: uid, product_name: summary, qty: qtyAll, total, phone, note: noteParts.join(" "), items, ship_name: name, ship_method: method, ship_point: method === "courier" ? address : null }
  );
  return NextResponse.json({ ok: true, id: newId, total });
}
