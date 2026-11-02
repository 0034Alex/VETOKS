import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser, notify } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { offerLive, loadProduct, sizeStockOf, publicProduct, currencyOfCountry } from "@/lib/businessServer";
import { stage1Ready, notifyShop, logAct } from "@/lib/orderFlow";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const MAX_ITEMS = 50;

// Видео, из которого товар попал в корзину: пост участника, где этот товар отмечен, и это не сам покупатель.
async function cartSource(postId: string, productId: string, uid: string): Promise<string | null> {
  if (!postId) return null;
  const probe = await supabaseAdmin.from("shop_cart_items").select("source_post_id").limit(1);
  if (probe.error) return null;
  const { data: tag } = await supabaseAdmin.from("post_products").select("id").eq("post_id", postId).eq("product_id", productId).maybeSingle();
  if (!tag) return null;
  const { data: post } = await supabaseAdmin.from("content_posts").select("user_id, participant_id").eq("id", postId).maybeSingle();
  if (!post || !(post as any).participant_id || (post as any).user_id === uid) return null;
  return postId;
}

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

    const srcPost = await cartSource(s(b.postId, 60), productId, uid);
    const all = await tbl().select("id, product_id, size, qty").eq("user_id", uid);
    if (all.error) return bad("cart_unavailable", 503);
    const rows = (all.data as any[]) ?? [];
    const same = rows.find((r) => r.product_id === productId && (r.size ?? "") === size);
    if (same) {
      await tbl().update({ qty: Math.min(99, Number(same.qty) + qty) }).eq("id", same.id);
      if (srcPost) await tbl().update({ source_post_id: srcPost }).eq("id", same.id);
    } else {
      if (rows.length >= MAX_ITEMS) return bad("cart_full");
      const ins = await tbl().insert({ user_id: uid, business_id: bid, product_id: productId, size: size || null, qty }).select("id").maybeSingle();
      if (ins.error) return bad("failed", 500);
      if (srcPost && ins.data) await tbl().update({ source_post_id: srcPost }).eq("id", String((ins.data as any).id));
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
    let ship: any = null;
    const sp = await supabaseAdmin.from("shop_delivery_profiles").select("full_name, phone, method, city, point").eq("user_id", uid).maybeSingle();
    if (!sp.error) ship = sp.data;
    return NextResponse.json({ ok: true, groups: r.groups, ship });
  }

  if (a === "checkout") {
    const rl = await rateLimit(req, "business/checkout", 20, 3600, uid);
    if (rl) return rl;
    if (!(await stage1Ready())) return bad("need_sql", 503);
    const sh = b.ship && typeof b.ship === "object" ? b.ship : {};
    const ship = {
      name: s(sh.name, 80),
      phone: s(sh.phone ?? b.phone, 40),
      method: ["np", "up", "courier", "pickup"].includes(String(sh.method)) ? String(sh.method) : "",
      city: s(sh.city, 80),
      point: s(sh.point, 160),
    };
    if (!ship.phone) return bad("need_phone");
    if (!ship.name) return bad("need_name");
    if (!ship.method) return bad("need_method");
    if (ship.method !== "pickup" && (!ship.city || !ship.point)) return bad("need_address");
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
      const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, country_id, is_active, is_hidden").eq("id", g.business_id).maybeSingle();
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

      // Собираем позиции этого магазина в один заказ.
      const items: any[] = [];
      const taken: { ln: any; product: any; ss: Record<string, number> | null; qty: number }[] = [];
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
        const lineTotal = Math.round(unit * qty * (1 - pct / 100) * 100) / 100;
        items.push({ product_id: product.id, name: product.name, sku: product.sku ?? null, size: ln.size || "", qty, unit, line_total: lineTotal });
        taken.push({ ln, product, ss, qty });
      }
      if (!items.length) { res.error = "nothing"; continue; }
      const total = Math.round(items.reduce((x: number, y: any) => x + Number(y.line_total), 0) * 100) / 100;
      const qtyAll = items.reduce((x: number, y: any) => x + Number(y.qty), 0);
      const summary = items.map((i: any) => `${i.name}${i.size ? ` (${i.size})` : ""}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ").slice(0, 200);
      const { data: created, error } = await supabaseAdmin.from("business_orders").insert({
        business_id: g.business_id, buyer_id: uid, kind: "buy", product_id: null, product_name: summary, sku: null, size: null,
        qty: qtyAll, unit_price: Number(items[0].unit), discount_percent: pct, total, promo_code: code, note, when_text: null, phone: ship.phone,
        items, ship_name: ship.name, ship_method: ship.method, ship_city: ship.city || null, ship_point: ship.point || null,
      }).select("id").maybeSingle();
      if (error || !created) { res.error = "failed"; continue; }
      const newId = String((created as any).id);

      // Откуда пришла покупка: видео участника (для будущих начислений).
      let srcPost: string | null = null;
      for (const tk of taken) {
        const sp = await supabaseAdmin.from("shop_cart_items").select("source_post_id").eq("id", tk.ln.id).maybeSingle();
        const v = !sp.error ? (sp.data as any)?.source_post_id : null;
        if (v) { srcPost = String(v); break; }
      }
      if (srcPost) {
        const { data: post } = await supabaseAdmin.from("content_posts").select("user_id, participant_id").eq("id", srcPost).maybeSingle();
        if (post && (post as any).participant_id && (post as any).user_id !== uid) {
          await supabaseAdmin.from("business_orders").update({ source_participant_id: (post as any).participant_id, source_post_id: srcPost }).eq("id", newId);
        }
      }

      // Списываем остатки и убираем купленное из корзины.
      for (const tk of taken) {
        const fresh: any = await loadProduct(tk.ln.product_id, g.business_id);
        const ss2 = fresh ? sizeStockOf(fresh) : tk.ss;
        if (ss2 && tk.ln.size in ss2) {
          const next: Record<string, number> = { ...ss2, [tk.ln.size]: Math.max(0, ss2[tk.ln.size] - tk.qty) };
          const sum = Object.values(next).reduce((x: number, y: number) => x + y, 0);
          await supabaseAdmin.from("business_products").update({ size_stock: next, stock: sum }).eq("id", tk.product.id);
        } else if (fresh && fresh.stock != null) {
          await supabaseAdmin.from("business_products").update({ stock: Math.max(0, Number(fresh.stock) - tk.qty) }).eq("id", tk.product.id);
        }
        await supabaseAdmin.from("shop_cart_items").delete().eq("id", tk.ln.id).eq("user_id", uid);
      }
      res.ok = true;
      res.cur = g.cur;
      res.total = total;
      res.orders.push(newId);
      if (offerId) {
        const { data: cur } = await supabaseAdmin.from("business_offers").select("used_count").eq("id", offerId).maybeSingle();
        await supabaseAdmin.from("business_offers").update({ used_count: Number((cur as any)?.used_count ?? 0) + 1 }).eq("id", offerId);
      }
      await logAct(newId, g.business_id, "buyer", "Покупатель", "created");
      await notifyShop(
        { id: g.business_id, user_id: String((bp as any).user_id) },
        `🛍 Новый заказ: ${summary}. Откройте «Заказы».`,
        `/business?tab=orders&o=${newId}`,
        { id: newId, kind: "buy", status: "new", buyer_id: uid, product_name: summary, qty: qtyAll, total, phone: ship.phone, note, items, ship_name: ship.name, ship_method: ship.method, ship_city: ship.city, ship_point: ship.point }
      );
    }

    // Запоминаем данные получателя, чтобы в следующий раз не вводить заново.
    if (b.save !== false && results.some((r) => r.ok)) {
      await supabaseAdmin.from("shop_delivery_profiles").upsert({ user_id: uid, full_name: ship.name, phone: ship.phone, method: ship.method, city: ship.city || null, point: ship.point || null, updated_at: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true, results });
  }

  return bad("bad_action");
}
