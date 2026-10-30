import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser, bad } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";
import { bizBio } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Публичная страница обычного человека (не участницы): только то, что он сам разрешил показывать.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const id = String(body.userId ?? "");
  if (!id) return bad("no_user");

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id, first_name, verified_badge, is_official, is_business, photo_url, bio, social_links, privacy, nick, is_banned, region_id, regions(name)")
    .eq("id", id)
    .maybeSingle();
  if (!u || u.is_banned) return bad("not_found", 404);
  if (me !== id && !(await sameCountry(me, id))) return bad("not_found", 404);

  // Бизнес-аккаунт: шапка берётся со страницы магазина.
  let biz: any = null;
  if ((u as any).is_business) {
    const bq = await supabaseAdmin.from("business_profiles").select("id, name, category, about, logo_url, cover_url, site_url, verified, is_active, is_hidden").eq("user_id", id).maybeSingle();
    if (bq.data && (bq.data as any).is_active && !(bq.data as any).is_hidden) biz = bq.data;
    else if (bq.data && me === id) biz = bq.data;
  }
  // Магазин, который человек выбрал у себя в профиле («Мой магазин»).
  let shop: any = null;
  if (!biz) {
    const sq = await supabaseAdmin.from("users").select("shop_business_id").eq("id", id).maybeSingle();
    const sid = !sq.error ? ((sq.data as any)?.shop_business_id as string | null) : null;
    if (sid) {
      const { data: sp } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, logo_url, is_active, is_hidden").eq("id", sid).maybeSingle();
      if (sp && (sp as any).is_active && !(sp as any).is_hidden) shop = { id: (sp as any).id, user_id: (sp as any).user_id, name: (sp as any).name, logo_url: (sp as any).logo_url ?? null };
    }
  }

  const { data: part } = await supabaseAdmin.from("participants").select("id").eq("user_id", id).maybeSingle();
  if (part) return NextResponse.json({ ok: true, participantId: part.id });

  const priv = ((u.privacy ?? {}) as Record<string, boolean>) || {};
  let following: number | null = null;
  if (priv.follows !== false) {
    const { count } = await supabaseAdmin
      .from("participant_follows")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id);
    const { count: c2 } = await supabaseAdmin
      .from("user_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", id);
    following = (count ?? 0) + (c2 ?? 0);
  }
  const { count: followers } = await supabaseAdmin
    .from("user_follows")
    .select("id", { count: "exact", head: true })
    .eq("followed_id", id);
  const { count: posts } = await supabaseAdmin
    .from("content_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id);
  const { data: fRow } = await supabaseAdmin
    .from("user_follows")
    .select("id")
    .eq("follower_id", me)
    .eq("followed_id", id)
    .maybeSingle();
  let links = Array.isArray(u.social_links) ? (u.social_links as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (biz?.site_url && !links.includes(biz.site_url)) links = [biz.site_url, ...links];
  return NextResponse.json({
    ok: true,
    isSelf: me === id,
    verified: !!(u as any).verified_badge || !!biz?.verified,
    isBusiness: !!biz,
    shop,
    official: !!(u as any).is_official,
    name: biz?.name || u.first_name || "Гость",
    photoUrl: (biz ? biz.logo_url || biz.cover_url : null) ?? u.photo_url ?? null,
    bio: (biz ? bizBio(biz) : "") || u.bio || "",
    city: priv.region === false ? null : (u as any).regions?.name ?? null,
    nick: (u as any).nick ?? null,
    socials: links,
    following,
    followers: followers ?? 0,
    posts: posts ?? 0,
    isFollowing: !!fRow,
    canWrite: priv.dm !== false,
  });
}
