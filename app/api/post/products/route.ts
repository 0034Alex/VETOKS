import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { currencyOfCountry } from "@/lib/businessServer";
import { setPostProducts, productsOfPost, postProductsReady, MAX_TAG_PRODUCTS, MAX_TAG_SHOPS } from "@/lib/postProducts";

export const dynamic = "force-dynamic";

// search — поиск товаров для отметки; get — товары поста; set — сохранить отметки (автор поста).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "get");

  if (a === "get") {
    return NextResponse.json({ ok: true, ...(await productsOfPost(String(b.postId ?? ""), uid)) });
  }

  if (a === "set") {
    const rl = await rateLimit(req, "post/products", 60, 3600, uid);
    if (rl) return rl;
    const ids = Array.isArray(b.productIds) ? b.productIds.map(String) : [];
    const r = await setPostProducts(uid, String(b.postId ?? ""), ids);
    if (!r.ok) return bad(r.error || "failed", r.error === "forbidden" ? 403 : 400);
    return NextResponse.json({ ok: true });
  }

  if (a === "search") {
    const rl = await rateLimit(req, "post/products-search", 200, 3600, uid);
    if (rl) return rl;
    if (!(await postProductsReady())) return NextResponse.json({ ok: true, items: [], need_sql: true });
    const q = String(b.q ?? "").trim().replace(/[%,()]/g, " ").slice(0, 40);
    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });
    const cid = await countryOfUser(uid);
    const { data: shops } = await supabaseAdmin
      .from("business_profiles")
      .select("id, user_id, name, country_id, is_active, is_hidden")
      .ilike("name", `%${q}%`)
      .eq("is_active", true)
      .limit(20);
    const live = new Map<string, any>();
    const addShop = (s: any) => {
      if (!s || !s.is_active || s.is_hidden) return;
      if (s.country_id && cid && cid !== s.country_id) return;
      live.set(String(s.id), s);
    };
    for (const s of (shops as any[]) ?? []) addShop(s);
    const byName = await supabaseAdmin.from("business_products").select("id, business_id, name, price, photo_url, is_active").ilike("name", `%${q}%`).eq("is_active", true).limit(40);
    const prods: any[] = ((byName.data as any[]) ?? []).slice();
    for (const s of Array.from(live.keys())) {
      const r = await supabaseAdmin.from("business_products").select("id, business_id, name, price, photo_url, is_active").eq("business_id", s).eq("is_active", true).limit(12);
      for (const p of ((r.data as any[]) ?? [])) if (!prods.some((x) => x.id === p.id)) prods.push(p);
    }
    const items: any[] = [];
    for (const p of prods) {
      const bid = String(p.business_id);
      if (!live.has(bid)) {
        const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, country_id, is_active, is_hidden").eq("id", bid).maybeSingle();
        addShop(bp);
      }
      const sh = live.get(bid);
      if (!sh) continue;
      items.push({ id: String(p.id), name: p.name, price: Number(p.price), photo: p.photo_url ?? null, business_id: bid, shop: sh.name, cur: await currencyOfCountry(sh.country_id) });
      if (items.length >= 30) break;
    }
    return NextResponse.json({ ok: true, items, limits: { products: MAX_TAG_PRODUCTS, shops: MAX_TAG_SHOPS } });
  }

  return bad("bad_action");
}
