import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DAY = 24 * 3600 * 1000;

// До какого числа действует реклама: «неделя» — 7 дней, «сезон» — до конца последнего этапа сезона страны.
async function activeUntil(duration: string, countryId: string | null): Promise<Date> {
  const now = Date.now();
  if (duration !== "season") return new Date(now + 7 * DAY);
  let sq = supabaseAdmin.from("seasons").select("id").order("created_at", { ascending: false }).limit(1);
  if (countryId) sq = sq.eq("country_id", countryId);
  const { data: se } = await sq.maybeSingle();
  if (se?.id) {
    const { data: st } = await supabaseAdmin.from("season_stages").select("ends_at").eq("season_id", se.id).order("ends_at", { ascending: false }).limit(1).maybeSingle();
    const end = st?.ends_at ? new Date(st.ends_at as string).getTime() : 0;
    if (end > now) return new Date(end);
  }
  return new Date(now + 90 * DAY);
}

export type PublishResult = { ok: boolean; manual?: boolean; until?: string };

// Оплаченная и одобренная заявка сама встаёт на своё место: баннер, логотип или страница журнала.
// Страна, регионы и возрастные категории берутся из места, которое выкупили.
export async function publishAd(requestId: string): Promise<PublishResult> {
  const { data: r } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id, name, link_url, ad_text, image_url, slot_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!r) return { ok: false };
  const { data: slot } = await supabaseAdmin
    .from("ad_slots")
    .select("category, duration, country_id, all_regions, audience, ad_slot_regions(region_id)")
    .eq("id", r.slot_id)
    .maybeSingle();
  if (!slot) return { ok: false };

  const cat = String(slot.category).replace(/_gf$/, "");
  const regionIds = ((slot as any).ad_slot_regions ?? []).map((x: any) => x.region_id);
  const common = {
    country_id: slot.country_id ?? null,
    all_regions: !!slot.all_regions,
    audience: (slot as any).audience?.length ? (slot as any).audience : ["main", "adult"],
    is_active: true,
  };
  const until = await activeUntil(String(slot.duration), (slot.country_id as string) ?? null);

  if (!r.image_url || cat === "jury") return { ok: true, manual: true };

  let table = "";
  let id: string | null = null;
  const regionRows = (key: string) => regionIds.map((region_id: string) => ({ [key]: id, region_id }));

  if (cat.startsWith("banner_")) {
    table = "promo_banners";
    const { count } = await supabaseAdmin.from("promo_banners").select("id", { count: "exact", head: true });
    const { data } = await supabaseAdmin
      .from("promo_banners")
      .insert({ ...common, image_url: r.image_url, link_url: r.link_url, placement: cat === "banner_partner_page" ? "partner_page" : "main", sort_order: count ?? 0 })
      .select("id")
      .single();
    id = (data as any)?.id ?? null;
    if (id && !common.all_regions && regionIds.length) await supabaseAdmin.from("promo_banner_regions").insert(regionRows("banner_id"));
  } else if (cat === "homepage") {
    table = "partner_logos";
    const { count } = await supabaseAdmin.from("partner_logos").select("id", { count: "exact", head: true });
    const { data } = await supabaseAdmin
      .from("partner_logos")
      .insert({ ...common, name: r.name, logo_url: r.image_url, link_url: r.link_url, sort_order: count ?? 0 })
      .select("id")
      .single();
    id = (data as any)?.id ?? null;
    if (id && !common.all_regions && regionIds.length) await supabaseAdmin.from("partner_logo_regions").insert(regionRows("logo_id"));
  } else if (cat === "magazine") {
    table = "magazine_ads";
    if (!r.link_url) return { ok: true, manual: true };
    const { count } = await supabaseAdmin.from("magazine_ads").select("id", { count: "exact", head: true });
    const { data } = await supabaseAdmin
      .from("magazine_ads")
      .insert({ ...common, image_url: r.image_url, description: r.ad_text, button_text: "Подробнее", button_link: r.link_url, sort_order: count ?? 0 })
      .select("id")
      .single();
    id = (data as any)?.id ?? null;
    if (id && !common.all_regions && regionIds.length) await supabaseAdmin.from("magazine_ad_regions").insert(regionRows("ad_id"));
  } else return { ok: true, manual: true };

  if (!id) return { ok: true, manual: true };
  await supabaseAdmin.from("ad_slot_requests").update({ live_table: table, live_id: String(id), live_until: until.toISOString() }).eq("id", requestId);
  return { ok: true, until: until.toISOString() };
}

// Применить одобренную правку к уже работающей рекламе.
export async function updateLive(req: { live_table: string | null; live_id: string | null; name: string; link_url: string | null; ad_text: string | null; image_url: string | null }) {
  if (!req.live_table || !req.live_id) return;
  if (req.live_table === "promo_banners") await supabaseAdmin.from("promo_banners").update({ image_url: req.image_url, link_url: req.link_url }).eq("id", req.live_id);
  if (req.live_table === "partner_logos") await supabaseAdmin.from("partner_logos").update({ name: req.name, logo_url: req.image_url, link_url: req.link_url }).eq("id", req.live_id);
  if (req.live_table === "magazine_ads") await supabaseAdmin.from("magazine_ads").update({ image_url: req.image_url, description: req.ad_text, button_link: req.link_url }).eq("id", req.live_id);
}

// Раз в сутки: у кого срок вышел — реклама выключается.
export async function expireAds(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id, live_table, live_id")
    .not("live_id", "is", null)
    .lt("live_until", new Date().toISOString())
    .limit(500);
  let n = 0;
  for (const r of (data ?? []) as any[]) {
    if (["promo_banners", "partner_logos", "magazine_ads"].includes(r.live_table)) {
      await supabaseAdmin.from(r.live_table).update({ is_active: false }).eq("id", r.live_id);
    }
    await supabaseAdmin.from("ad_slot_requests").update({ live_id: null }).eq("id", r.id);
    n++;
  }
  return n;
}
