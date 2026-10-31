import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser, notify } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { offerLive, loadProduct, sizeStockOf, publicProduct, currencyOfCountry } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const MAX_ITEMS = 50;

// Корзина: товары из разных магазинов. Покупка: каждому магазину уходит свой заказ со своими товарами.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "list");

  const tbl = () => supabaseAdmin.from("shop_cart_items");

  if (a === "count") {
    const r = await tbl().select("qty", { count: "exact" }).eq("user_id", uid);
    if (r.error) return NextResponse.json({ ok: true, count: 0 });
    return NextResponse.json({ ok: true, count: ((r.data as any[]) ?? []).reduce((x, y) => x + Number(y.qty || 0), 0) });
  }

  if (a === "add") {
    const rl = await rateLimit(req, "business/cart", 120, 3600, uid);
    if (rl) return rl;
    const productId = s(b.productId, 60);
    const { data: pr0 } = await supabaseAdmin.from("business_products").select("business_id").eq("id", productId).maybeSingle();
    if (!pr0) return bad("no_product", 404);
    const bid = String((pr0 as any).business_id);
    const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, country_id, is_active, is_hidden").eq("id", bid).maybeSingle();
    if (!bp || !(bp as any).is_active || (bp as any).is_hidden) return bad("not_found", 404);
    if ((bp as any).user_id === uid) return bad("own_business");
    if ((bp as any).country_id) {
      const cid = await countryOfUser(uid);
      if (cid && cid !== (bp as any).country_id) return bad("not_found", 404);
    }
    const product = await loadProduct(productId, bid);
    if (!product || !product.is_active) return bad("no_product", 404);
    const size = s(b.size, 30);
    const ss = sizeStockOf(product);
    const sizes = ss ? Object.keys(ss) : String(product.sizes ?? "").split(",").map((x: string) => x.trim()).filter(Boolean);
    if (sizes.length && !sizes.includes(size)) return bad("need_size");
    if (ss && ss[size] <= 0) return bad("no_stock");
    if (!ss && product.stock != null && Number(product.stock) <= 0) return bad("no_stock");
    const qty = Math.min(99, Math.max(1, Math.floor(Number(b.qty) || 1)));

    const all = await tbl().select("id, product_id, size, qty").eq("user_id", uid);
    if (all.error) return bad("cart_unavailable", 503);
    const rows = (all.data as any[]) ?? [];
    const same = rows.find((r) => r.product_id === productId && (r.size ?? "") === size);
    if (same) {
      await tbl().update({ qty: Math.min(99, Number(same.qty) + qty) }).eq("id", same.id);
    } else {
      if (rows.length >= MAX_ITEMS) return bad("cart_full");
      const { error } = await tbl().insert({ user_id: uid, business_id: bid, product_id: productId, size: size || null, qty });
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true });
  }

  if (a === "set") {
    const qty = Math.floor(Number(b.qty) || 0);
    if (qty <= 0) await tbl().delete().eq("id", s(b.id, 60)).eq("user_id", uid);
    else await tbl().update({ qty: Math.min(99, qty) }).eq("id", s(b.id, 60)).eq("user_id", uid);
    return NextResponse.json({ ok: true });
  }

  if (a === "remove") {
    await tbl().delete().eq("id", s(b.id, 60)).eq("user_id", uid);
    return NextResponse.json({ ok: true });
  }

  // Содержимое корзины, разложенное по магазинам, с проверкой наличия.
  async function load() {
    const r = await tbl().select("id, business_id, product_id, size, qty, created_at").eq("user_id", uid as string).order("created_at", { ascending: true });
    if (r.error) return { ok: false as const, groups: [] as any[] };
    const items = (r.data as any[]) ?? [];
    const bids = Array.from(new Set(items.map((x) => x.business_id)));
    const groups: any[] = [];
    for (const bid of bids) {
      const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, logo_url, country_id, is_active, is_hidden").eq("id", bid).maybeSingle();
      const live = !!bp && (bp as any).is_active && !(bp as any).is_hidden;
      const cur = bp ? await currencyOfCountry((bp as any).country_id) : "₴";
      const lines: any[] = [];
      for (const it of items.filter((x) => x.business_id === bid)) {
        const prod = live ? await loadProduct(it.product_id, bid) : null;
        let problem = "";
        let p: any = null;
        if (!prod || !prod.is_active) problem = "gone";
        else {
          p = publicProduct(prod);
          const ss = p.size_stock;
          const left = ss ? (it.size ? ss[it.size] ?? 0 : 0) : p.stock;
          if (left !== null && left <= 0) problem = "out";
          else if (left !== null && left < it.qty) problem = "less";
        }
        lines.push({ id: it.id, product_id: it.product_id, size: it.size ?? "", qty: it.qty, problem, name: p?.name ?? "Товар недоступен", price: p?.price ?? 0, photo: p?.photos?.[0] ?? null, sku: p?.sku ?? "" });
      }
      groups.push({ business_id: bid, name: (bp as any)?.name ?? "Магазин", logo_url: (bp as any)?.logo_url ?? null, user_id: (bp as any)?.user_id ?? null, live, cur, lines });
    }
    return { ok: true as const, groups };
  }

  if (a === "list") {
    const r = await load();
    if (!r.ok) return NextResponse.json({ ok: true, groups: [], unavailable: true });
    return NextResponse.json({ ok: true, groups: r.groups });
  }

  if (a === "checkout") {
    const rl = await rateLimit(req, "business/checkout", 20, 3600, uid);
    if (rl) return rl;
    const phone = s(b.phone, 40);
    if (!phone) return bad("need_phone");
    const only: string | null = b.businessId ? String(b.businessId) : null;
    const promos: Record<string, string> = b.promos && typeof b.promos === "object" ? b.promos : {};
    const note = s(b.note, 500) || null;
    const cid = await countryOfUser(uid);
    const cart = await load();
    if (!cart.ok) return bad("cart_unavailable", 503);
    const results: any[] = [];

    for (const g of cart.groups) {
      if (only && g.business_id !== only) continue;
      const res: any = { businessId: g.business_id, name: g.name, ok: false, orders: [], total: 0, skipped: 0, error: "" };
      results.push(res);
      const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, country_id, is_active, is_hidden").eq("id", g.business_id).maybeSingle();
      if (!bp || !(bp as any).is_active || (bp as any).is_hidden) { res.error = "not_found"; continue; }
      if ((bp as any).user_id === uid) { res.error = "own_business"; continue; }
      if ((bp as any).country_id && cid && cid !== (bp as any).country_id) { res.error = "not_found"; continue; }

      let pct = 0;
      let code: string | null = null;
      let offerId: string | null = null;
      const raw = s(promos[g.business_id], 30).toUpperCase().replace(/\s+/g, "");
      if (raw) {
        const { data: of } = await supabaseAdmin.from("business_offers").select("id, promo_code, discount_percent, valid_until, usage_limit, used_count, is_active").eq("business_id", g.business_id).eq("promo_code", raw).maybeSingle();
        if (!of || !offerLive(of)) { res.error = "promo_invalid"; continue; }
        pct = Math.min(100, Math.max(0, Number((of as any).discount_percent) || 0));
        code = raw;
        offerId = (of as any).id;
      }

      const names: string[] = [];
      for (const ln of g.lines) {
        if (ln.problem) { res.skipped++; continue; }
        const product = await loadProduct(ln.product_id, g.business_id);
        if (!product || !product.is_active) { res.skipped++; continue; }
        const ss = sizeStockOf(product);
        const qty = Number(ln.qty);
        if (ss) {
          if (!(ln.size in ss) || ss[ln.size] < qty) { res.skipped++; continue; }
        } else if (product.stock != null && Number(product.stock) < qty) { res.skipped++; continue; }
        const unit = Number(product.price);
        const total = Math.round(unit * qty * (1 - pct / 100) * 100) / 100;
        const { data: created, error } = await supabaseAdmin.from("business_orders").insert({
          business_id: g.business_id, buyer_id: uid, kind: "buy", product_id: product.id, product_name: product.name, sku: product.sku ?? null,
          size: ln.size || null, qty, unit_price: unit, discount_percent: pct, total, promo_code: code, note, when_text: null, phone,
        }).select("id").maybeSingle();
        if (error || !created) { res.skipped++; continue; }
        if (ss) {
          const next: Record<string, number> = { ...ss, [ln.size]: Math.max(0, ss[ln.size] - qty) };
          const sum = Object.values(next).reduce((x: number, y: number) => x + y, 0);
          await supabaseAdmin.from("business_products").update({ size_stock: next, stock: sum }).eq("id", product.id);
        } else if (product.stock != null) {
          await supabaseAdmin.from("business_products").update({ stock: Math.max(0, Number(product.stock) - qty) }).eq("id", product.id);
        }
        await supabaseAdmin.from("shop_cart_items").delete().eq("id", ln.id).eq("user_id", uid);
        res.orders.push((created as any).id);
        res.total = Math.round((res.total + total) * 100) / 100;
        names.push(`${product.name}${ln.size ? ` (${ln.size})` : ""}${qty > 1 ? ` ×${qty}` : ""}`);
      }
      if (res.orders.length) {
        res.ok = true;
        res.cur = g.cur;
        if (offerId) {
          const { data: cur } = await supabaseAdmin.from("business_offers").select("used_count").eq("id", offerId).maybeSingle();
          await supabaseAdmin.from("business_offers").update({ used_count: Number((cur as any)?.used_count ?? 0) + 1 }).eq("id", offerId);
        }
        await notify((bp as any).user_id, `🛍 Новый заказ: ${names.join(", ")}. Откройте «Заказы».`, `/business?tab=orders&o=${res.orders[0]}`, "other");
      } else if (!res.error) res.error = "nothing";
    }
    return NextResponse.json({ ok: true, results });
  }

  return bad("bad_action");
}
