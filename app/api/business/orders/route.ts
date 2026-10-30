import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser, notify } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { offerLive } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"];
const ORDER_COLS = "id, business_id, buyer_id, kind, product_id, product_name, sku, size, qty, unit_price, discount_percent, total, promo_code, note, when_text, phone, status, created_at";

const STATUS_TEXT: Record<string, string> = {
  confirmed: "подтверждён",
  shipped: "отправлен",
  done: "выполнен",
  cancelled: "отменён",
};

// Заказы между зрителем и партнёром. Деньги идут напрямую партнёру, VETOKS в оплате не участвует.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = b.action;

  if (a === "create") {
    const rl = await rateLimit(req, "business/order", 20, 3600, uid);
    if (rl) return rl;
    const { data: bp } = await supabaseAdmin
      .from("business_profiles")
      .select("id, user_id, name, country_id, is_active, is_hidden")
      .eq("id", String(b.businessId ?? ""))
      .maybeSingle();
    if (!bp || !(bp as any).is_active || (bp as any).is_hidden) return bad("not_found", 404);
    if ((bp as any).user_id === uid) return bad("own_business");
    if ((bp as any).country_id) {
      const cid = await countryOfUser(uid);
      if (cid && cid !== (bp as any).country_id) return bad("not_found", 404);
    }
    const kind = b.kind === "book" ? "book" : "buy";
    const phone = s(b.phone, 40);
    if (!phone) return bad("need_phone");
    const qty = Math.min(99, Math.max(1, Math.floor(Number(b.qty) || 1)));

    let product: any = null;
    if (b.productId) {
      const { data: pr } = await supabaseAdmin
        .from("business_products")
        .select("id, sku, name, price, sizes, stock, is_active, business_id")
        .eq("id", String(b.productId))
        .eq("business_id", (bp as any).id)
        .maybeSingle();
      if (!pr || !(pr as any).is_active) return bad("no_product", 404);
      product = pr;
      if (product.stock != null && Number(product.stock) < qty) return bad("no_stock");
    } else if (kind === "buy") {
      return bad("no_product");
    }
    const sizes = String(product?.sizes ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const size = s(b.size, 30);
    if (sizes.length && !sizes.includes(size)) return bad("need_size");

    // Промокод
    let pct = 0;
    let usedCode: string | null = null;
    let offerId: string | null = null;
    const code = s(b.promo, 30).toUpperCase().replace(/\s+/g, "");
    if (code) {
      const { data: of } = await supabaseAdmin
        .from("business_offers")
        .select("id, promo_code, discount_percent, valid_until, usage_limit, used_count, is_active")
        .eq("business_id", (bp as any).id)
        .eq("promo_code", code)
        .maybeSingle();
      if (!of || !offerLive(of)) return bad("promo_invalid");
      pct = Math.min(100, Math.max(0, Number((of as any).discount_percent) || 0));
      usedCode = code;
      offerId = (of as any).id;
    }
    const unit = product ? Number(product.price) : 0;
    const total = Math.round(unit * qty * (1 - pct / 100) * 100) / 100;

    const { data: created, error } = await supabaseAdmin
      .from("business_orders")
      .insert({
        business_id: (bp as any).id,
        buyer_id: uid,
        kind,
        product_id: product?.id ?? null,
        product_name: product ? product.name : s(b.service, 120) || "Бронь",
        sku: product?.sku ?? null,
        size: size || null,
        qty,
        unit_price: unit,
        discount_percent: pct,
        total,
        promo_code: usedCode,
        note: s(b.note, 500) || null,
        when_text: s(b.whenText, 80) || null,
        phone,
      })
      .select("id")
      .maybeSingle();
    if (error || !created) return bad("failed", 500);

    if (product && product.stock != null) {
      await supabaseAdmin.from("business_products").update({ stock: Math.max(0, Number(product.stock) - qty) }).eq("id", product.id);
    }
    if (offerId) {
      const { data: cur } = await supabaseAdmin.from("business_offers").select("used_count").eq("id", offerId).maybeSingle();
      await supabaseAdmin.from("business_offers").update({ used_count: Number((cur as any)?.used_count ?? 0) + 1 }).eq("id", offerId);
    }
    await notify(
      (bp as any).user_id,
      `🛍 Новый ${kind === "book" ? "запрос на бронь" : "заказ"}: ${product ? product.name : "бронь"}. Откройте «Заказы».`,
      `/business?tab=orders&o=${(created as any).id}`,
      "other"
    );
    return NextResponse.json({ ok: true, id: (created as any).id, total });
  }

  if (a === "my") {
    const { data } = await supabaseAdmin.from("business_orders").select(ORDER_COLS).eq("buyer_id", uid).order("created_at", { ascending: false }).limit(100);
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.business_id)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: bs } = await supabaseAdmin.from("business_profiles").select("id, name").in("id", ids);
      ((bs as any[]) ?? []).forEach((x) => (names[x.id] = x.name));
    }
    return NextResponse.json({ ok: true, items: rows.map((r) => ({ ...r, business_name: names[r.business_id] ?? "" })) });
  }

  if (a === "biz") {
    const { data: bp } = await supabaseAdmin.from("business_profiles").select("id").eq("user_id", uid).maybeSingle();
    if (!bp) return bad("no_business", 404);
    const { data } = await supabaseAdmin.from("business_orders").select(ORDER_COLS).eq("business_id", (bp as any).id).order("created_at", { ascending: false }).limit(200);
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.buyer_id)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: us } = await supabaseAdmin.from("users").select("id, first_name").in("id", ids);
      ((us as any[]) ?? []).forEach((x) => (names[x.id] = x.first_name || "Покупатель"));
    }
    return NextResponse.json({ ok: true, items: rows.map((r) => ({ ...r, buyer_name: names[r.buyer_id] ?? "Покупатель" })) });
  }

  // Дальше действия над одним заказом: доступ только покупателю и владельцу страницы.
  const oid = String(b.id ?? "");
  if (!oid) return bad("no_id");
  const { data: o } = await supabaseAdmin.from("business_orders").select(ORDER_COLS).eq("id", oid).maybeSingle();
  if (!o) return bad("not_found", 404);
  const { data: bp2 } = await supabaseAdmin.from("business_profiles").select("id, user_id, name").eq("id", (o as any).business_id).maybeSingle();
  const isBuyer = (o as any).buyer_id === uid;
  const isOwner = !!bp2 && (bp2 as any).user_id === uid;
  if (!isBuyer && !isOwner) return bad("forbidden", 403);
  const other = isBuyer ? (bp2 as any)?.user_id : (o as any).buyer_id;
  const link = isBuyer ? `/business?tab=orders&o=${oid}` : `/my-orders?o=${oid}`;

  if (a === "get") {
    const { data: msgs } = await supabaseAdmin
      .from("business_order_messages")
      .select("id, sender_id, body, created_at")
      .eq("order_id", oid)
      .order("created_at", { ascending: true })
      .limit(300);
    const { data: bu } = await supabaseAdmin.from("users").select("first_name").eq("id", (o as any).buyer_id).maybeSingle();
    return NextResponse.json({
      ok: true,
      order: { ...(o as any), business_name: (bp2 as any)?.name ?? "", buyer_name: (bu as any)?.first_name ?? "Покупатель" },
      messages: msgs ?? [],
      me: uid,
      role: isOwner ? "owner" : "buyer",
    });
  }

  if (a === "send") {
    const rl = await rateLimit(req, "business/order-msg", 60, 600, uid);
    if (rl) return rl;
    const body = s(b.body, 1000);
    if (!body) return bad("empty");
    const { error } = await supabaseAdmin.from("business_order_messages").insert({ order_id: oid, sender_id: uid, body });
    if (error) return bad("failed", 500);
    if (other) await notify(other, `💬 Новое сообщение по заказу «${(o as any).product_name}»`, link, "other");
    return NextResponse.json({ ok: true });
  }

  if (a === "status") {
    const st = String(b.status ?? "");
    if (!STATUSES.includes(st) || st === "new") return bad("bad_status");
    const cur = (o as any).status as string;
    if (isBuyer && !isOwner) {
      // Покупатель может только отменить новый заказ.
      if (!(st === "cancelled" && cur === "new")) return bad("forbidden", 403);
    }
    if (cur === "cancelled" || cur === "done") return bad("closed");
    await supabaseAdmin.from("business_orders").update({ status: st, updated_at: new Date().toISOString() }).eq("id", oid);
    if (st === "cancelled" && (o as any).product_id) {
      const { data: pr } = await supabaseAdmin.from("business_products").select("stock").eq("id", (o as any).product_id).maybeSingle();
      if (pr && (pr as any).stock != null) {
        await supabaseAdmin.from("business_products").update({ stock: Number((pr as any).stock) + Number((o as any).qty) }).eq("id", (o as any).product_id);
      }
    }
    if (other) await notify(other, `Заказ «${(o as any).product_name}» ${STATUS_TEXT[st] ?? st}`, link, "other");
    return NextResponse.json({ ok: true });
  }

  return bad("bad_action");
}
