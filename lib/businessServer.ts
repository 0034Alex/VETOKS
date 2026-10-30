import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { familyMembers, familyRootId } from "@/lib/familyServer";

export const BIZ_COLS =
  "id, user_id, sponsor_id, country_id, region_id, name, category, about, logo_url, cover_url, hours, address, phone, email, site_url, quick_action, is_active, verified, is_hidden";

// Что видит зритель на странице партнёра (без служебных полей).
export function publicBiz(p: any) {
  return {
    id: p.id,
    name: p.name,
    category: p.category ?? "",
    about: p.about ?? "",
    logo_url: p.logo_url ?? null,
    cover_url: p.cover_url ?? null,
    hours: p.hours ?? "",
    address: p.address ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    site_url: p.site_url ?? "",
    quick_action: p.quick_action === "book" ? "book" : "buy",
    verified: !!p.verified,
  };
}

export const PRODUCT_COLS = "id, business_id, sku, name, description, price, photo_url, sizes, stock, is_active";
export const OFFER_COLS = "id, business_id, title, description, promo_code, discount_percent, valid_until, usage_limit, used_count, is_active";

// Предложение действует: включено, срок не вышел, лимит не исчерпан.
export function offerLive(o: any): boolean {
  if (!o?.is_active) return false;
  if (o.valid_until && String(o.valid_until) < new Date().toISOString().slice(0, 10)) return false;
  if (o.usage_limit != null && Number(o.used_count) >= Number(o.usage_limit)) return false;
  return true;
}

// Зрителю промокод не отдаём целиком только в виде значения: код виден, он нужен для ввода.
export function publicOffer(o: any) {
  return {
    id: o.id,
    title: o.title,
    description: o.description ?? "",
    promo_code: o.promo_code ?? "",
    discount_percent: o.discount_percent ?? null,
    valid_until: o.valid_until ?? null,
  };
}

// Символ валюты страны партнёра.
export async function currencyOfCountry(countryId: string | null | undefined): Promise<string> {
  if (!countryId) return "₴";
  const { data } = await supabaseAdmin.from("countries").select("currency_symbol").eq("id", countryId).maybeSingle();
  return ((data as any)?.currency_symbol as string) || "₴";
}

// Бизнес-режим доступен только одобренным партнёрам: смотрим заявки всех аккаунтов «семьи».
export async function businessContext(uid: string) {
  const rootId = await familyRootId(uid);
  if (!rootId) return null;
  const members = await familyMembers(rootId);
  const ids = members.map((m) => m.id);
  const { data: sps } = await supabaseAdmin
    .from("sponsors")
    .select("id, name, country_id, status, user_id")
    .in("user_id", ids)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  const sponsor = ((sps ?? [])[0] as any) ?? null;
  const { data: prof } = await supabaseAdmin.from("business_profiles").select(BIZ_COLS).in("user_id", ids).maybeSingle();
  return { rootId, members, sponsor, profile: (prof as any) ?? null };
}
