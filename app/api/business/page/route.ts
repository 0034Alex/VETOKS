import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { BIZ_COLS, PRODUCT_COLS, OFFER_COLS, publicBiz, publicOffer, offerLive, currencyOfCountry } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Публичная страница партнёра. Видна всем сразу, пока партнёр включил её и не скрыл владелец.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  let id = String(b.id ?? "");
  const byUser = String(b.userId ?? "");
  if (!id && !byUser) return bad("no_id");
  const { data: p } = await (id
    ? supabaseAdmin.from("business_profiles").select(BIZ_COLS).eq("id", id)
    : supabaseAdmin.from("business_profiles").select(BIZ_COLS).eq("user_id", byUser)
  ).maybeSingle();
  if (!p) return bad("not_found", 404);
  id = String((p as any).id);
  const mine = (p as any).user_id === uid;
  // Сотрудники CRM открывают любую страницу партнёра, даже не опубликованную, для предпросмотра.
  const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  const staff = ["moderator", "finance_admin", "super_admin"].includes((me as any)?.role);
  const hidden = !(p as any).is_active || (p as any).is_hidden;
  if (!mine && !staff && hidden) return bad("not_found", 404);
  if (!mine && !staff && (p as any).country_id) {
    const cid = await countryOfUser(uid);
    if (cid && cid !== (p as any).country_id) return bad("not_found", 404);
  }
  // Каталог и предложения: если SQL этапа 2 ещё не выполнен, просто пусто.
  const pq = await supabaseAdmin.from("business_products").select(PRODUCT_COLS).eq("business_id", id).eq("is_active", true).order("created_at", { ascending: true }).limit(200);
  const oq = await supabaseAdmin.from("business_offers").select(OFFER_COLS).eq("business_id", id).eq("is_active", true).order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({
    ok: true,
    profile: publicBiz(p),
    mine,
    userId: (p as any).user_id,
    staffPreview: staff && !mine,
    notPublished: hidden,
    isHidden: !!(p as any).is_hidden,
    cur: await currencyOfCountry((p as any).country_id),
    products: ((pq.data as any[]) ?? []).map((x) => ({ id: x.id, sku: x.sku ?? "", name: x.name, description: x.description ?? "", price: Number(x.price), photo_url: x.photo_url ?? null, sizes: x.sizes ?? "", stock: x.stock })),
    offers: ((oq.data as any[]) ?? []).filter(offerLive).map(publicOffer),
  });
}
