import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { PRODUCT_COLS, OFFER_COLS } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const intOrNull = (v: any) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Math.floor(Number(v));
  return isFinite(n) && n >= 0 ? n : null;
};

// Каталог и предложения: правит только владелец своей страницы.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "business/manage", 120, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const { data: bp } = await supabaseAdmin.from("business_profiles").select("id").eq("user_id", uid).maybeSingle();
  if (!bp) return bad("no_business", 404);
  const bid = (bp as any).id as string;
  const a = b.action;

  if (a === "products") {
    const { data } = await supabaseAdmin.from("business_products").select(PRODUCT_COLS).eq("business_id", bid).order("created_at", { ascending: false }).limit(300);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (a === "product_save") {
    const name = s(b.name, 120);
    if (!name) return bad("empty_name");
    const price = Number(b.price);
    if (!isFinite(price) || price < 0) return bad("bad_price");
    const row: Record<string, any> = {
      sku: s(b.sku, 40) || null,
      name,
      description: s(b.description, 1000) || null,
      price: Math.round(price * 100) / 100,
      photo_url: s(b.photo_url, 500) || null,
      sizes: s(b.sizes, 200) || null,
      stock: intOrNull(b.stock),
      is_active: b.is_active === undefined ? true : !!b.is_active,
    };
    if (b.id) {
      const { error } = await supabaseAdmin.from("business_products").update(row).eq("id", String(b.id)).eq("business_id", bid);
      if (error) return bad("failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("business_products").insert({ ...row, business_id: bid });
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true });
  }

  if (a === "offers") {
    const { data } = await supabaseAdmin.from("business_offers").select(OFFER_COLS).eq("business_id", bid).order("created_at", { ascending: false }).limit(100);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (a === "offer_save") {
    const title = s(b.title, 120);
    if (!title) return bad("empty_name");
    const pct = intOrNull(b.discount_percent);
    const code = s(b.promo_code, 30).toUpperCase().replace(/\s+/g, "") || null;
    if (pct != null && pct > 100) return bad("bad_percent");
    if (pct != null && pct > 0 && !code) return bad("need_code");
    const row: Record<string, any> = {
      title,
      description: s(b.description, 500) || null,
      promo_code: code,
      discount_percent: pct,
      valid_until: s(b.valid_until, 10) || null,
      usage_limit: intOrNull(b.usage_limit),
      is_active: b.is_active === undefined ? true : !!b.is_active,
    };
    if (b.id) {
      const { error } = await supabaseAdmin.from("business_offers").update(row).eq("id", String(b.id)).eq("business_id", bid);
      if (error) return bad("failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("business_offers").insert({ ...row, business_id: bid });
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true });
  }
  return bad("bad_action");
}
