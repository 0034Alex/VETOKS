import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { BIZ_COLS, OFFER_COLS, publicBiz, publicOffer, offerLive, currencyOfCountry, loadProducts, publicProduct } from "@/lib/businessServer";
import { parseLinks } from "@/lib/socialLinks";

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
  // Каталог и предложения: если SQL ещё не выполнен, просто пусто.
  const prods = (await loadProducts(id, true, 200)).map(publicProduct);
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
    products: prods,
    extra: await ownerExtra(uid, (p as any).user_id, id, (p as any).site_url),
    offers: ((oq.data as any[]) ?? []).filter(offerLive).map(publicOffer),
  });
}

// Шапка бизнес-профиля: подписчики, подписки, покупки, соцсети, можно ли писать.
async function ownerExtra(me: string, ownerId: string, bizId: string, siteUrl: string | null) {
  const cnt = async (q: any) => {
    const { count } = await q;
    return count ?? 0;
  };
  const followers = await cnt(supabaseAdmin.from("user_follows").select("id", { count: "exact", head: true }).eq("followed_id", ownerId));
  const f1 = await cnt(supabaseAdmin.from("participant_follows").select("id", { count: "exact", head: true }).eq("user_id", ownerId));
  const f2 = await cnt(supabaseAdmin.from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", ownerId));
  let purchases = 0;
  try {
    purchases = await cnt(supabaseAdmin.from("business_orders").select("id", { count: "exact", head: true }).eq("business_id", bizId).in("status", ["done", "received"]));
  } catch {}
  const { data: fRow } = await supabaseAdmin.from("user_follows").select("id").eq("follower_id", me).eq("followed_id", ownerId).maybeSingle();
  const { data: u } = await supabaseAdmin.from("users").select("social_links, privacy").eq("id", ownerId).maybeSingle();
  let socials = parseLinks((u as any)?.social_links);
  if (siteUrl && !socials.includes(siteUrl)) socials = [siteUrl, ...socials];
  const priv = (((u as any)?.privacy ?? {}) as Record<string, boolean>) || {};
  return { followers, following: f1 + f2, purchases, isFollowing: !!fRow, socials, canWrite: priv.dm !== false };
}
