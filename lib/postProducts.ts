import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser } from "@/lib/countryServer";
import { loadProduct, publicProduct, currencyOfCountry } from "@/lib/businessServer";

export const MAX_TAG_SHOPS = 2;
export const MAX_TAG_PRODUCTS = 5;

export async function postProductsReady(): Promise<boolean> {
  const r = await supabaseAdmin.from("post_products").select("id").limit(1);
  return !r.error;
}

// Пост участника: только у него есть «Купить».
export async function postOwner(postId: string): Promise<{ user_id: string; participant_id: string | null } | null> {
  const { data } = await supabaseAdmin.from("content_posts").select("user_id, participant_id").eq("id", postId).maybeSingle();
  if (!data) return null;
  return { user_id: String((data as any).user_id), participant_id: (data as any).participant_id ? String((data as any).participant_id) : null };
}

// Сохраняет набор товаров поста (автор поста, максимум 2 магазина и 5 товаров, своя страна, чужие магазины).
export async function setPostProducts(uid: string, postId: string, ids: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!(await postProductsReady())) return { ok: false, error: "need_sql" };
  const own = await postOwner(postId);
  if (!own || own.user_id !== uid) return { ok: false, error: "forbidden" };
  if (!own.participant_id) return { ok: false, error: "not_participant" };
  const uniq = Array.from(new Set(ids.map((x) => String(x).slice(0, 60)))).filter(Boolean);
  if (uniq.length > MAX_TAG_PRODUCTS) return { ok: false, error: "too_many_products" };
  const cid = await countryOfUser(uid);
  const rows: { post_id: string; product_id: string; business_id: string; tagger_id: string }[] = [];
  const shops = new Set<string>();
  for (const pid of uniq) {
    const { data: pr } = await supabaseAdmin.from("business_products").select("id, business_id, is_active").eq("id", pid).maybeSingle();
    if (!pr || !(pr as any).is_active) continue;
    const bid = String((pr as any).business_id);
    const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, country_id, is_active, is_hidden").eq("id", bid).maybeSingle();
    if (!bp || !(bp as any).is_active || (bp as any).is_hidden) continue;
    if ((bp as any).country_id && cid && cid !== (bp as any).country_id) continue;
    shops.add(bid);
    rows.push({ post_id: postId, product_id: pid, business_id: bid, tagger_id: uid });
  }
  if (shops.size > MAX_TAG_SHOPS) return { ok: false, error: "too_many_shops" };
  await supabaseAdmin.from("post_products").delete().eq("post_id", postId);
  if (rows.length) {
    const { error } = await supabaseAdmin.from("post_products").insert(rows);
    if (error) return { ok: false, error: "failed" };
  }
  return { ok: true };
}

// Товары поста для зрителя: только живые, только участник-автор, только своя страна.
export async function productsOfPost(postId: string, viewerId: string | null): Promise<{ shops: any[] }> {
  if (!(await postProductsReady())) return { shops: [] };
  const own = await postOwner(postId);
  if (!own || !own.participant_id) return { shops: [] };
  const { data } = await supabaseAdmin.from("post_products").select("product_id, business_id").eq("post_id", postId);
  const list = (data as any[]) ?? [];
  if (!list.length) return { shops: [] };
  const cid = viewerId ? await countryOfUser(viewerId) : null;
  const out: Record<string, any> = {};
  for (const r of list) {
    const bid = String(r.business_id);
    if (!out[bid]) {
      const { data: bp } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, logo_url, country_id, is_active, is_hidden").eq("id", bid).maybeSingle();
      if (!bp || !(bp as any).is_active || (bp as any).is_hidden) continue;
      if ((bp as any).country_id && cid && cid !== (bp as any).country_id) continue;
      out[bid] = { business_id: bid, name: (bp as any).name, logo_url: (bp as any).logo_url ?? null, mine: viewerId ? (bp as any).user_id === viewerId : false, cur: await currencyOfCountry((bp as any).country_id), products: [] };
    }
    const prod = await loadProduct(String(r.product_id), bid);
    if (!prod || !prod.is_active) continue;
    const p: any = publicProduct(prod);
    out[bid].products.push({ id: p.id, name: p.name, price: p.price, photo: p.photos?.[0] ?? null, sizes: p.size_stock ? Object.keys(p.size_stock).filter((k) => p.size_stock[k] > 0) : String(prod.sizes ?? "").split(",").map((x: string) => x.trim()).filter(Boolean), out: p.size_stock ? !Object.values(p.size_stock).some((v: any) => v > 0) : p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0 });
  }
  return { shops: Object.values(out).filter((s: any) => s.products.length) };
}
