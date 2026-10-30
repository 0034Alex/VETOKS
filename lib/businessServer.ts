import { randomBytes, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { autoFollowOfficial } from "@/lib/officialFollow";
import { familyMembers, familyRootId, MAX_SUB_ACCOUNTS } from "@/lib/familyServer";

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

// Создаёт бизнес-аккаунт (отдельный аккаунт «семьи» + страницу). Общий код для кабинета партнёра и для CRM.
export async function createBusinessAccount(
  rootId: string,
  sponsor: { id: string; name: string; country_id: string | null },
  prefill: { phone?: string; email?: string } = {}
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const members = await familyMembers(rootId);
  const { data: root } = await supabaseAdmin
    .from("users")
    .select("phone_verified, region_id, is_banned, birth_date, age_category")
    .eq("id", rootId)
    .maybeSingle();
  if (!root || (root as any).is_banned) return { ok: false, error: "banned" };
  if (!(root as any).phone_verified) return { ok: false, error: "need_phone" };
  if (members.length - 1 >= MAX_SUB_ACCOUNTS) return { ok: false, error: "no_slot" };

  const { data: created, error: ce } = await supabaseAdmin.auth.admin.createUser({
    email: `sub-${randomUUID()}@sub.vetoks.app`,
    password: randomBytes(24).toString("hex"),
    email_confirm: true,
  });
  if (ce || !created?.user) return { ok: false, error: "create_failed" };
  const newId = created.user.id;
  const name = String(sponsor.name || "Бизнес").slice(0, 60);

  const { error: ie } = await supabaseAdmin.from("users").insert({
    id: newId,
    first_name: name,
    region_id: (root as any).region_id,
    birth_date: (root as any).birth_date ?? null,
    age_category: (root as any).age_category ?? null,
    role: "viewer",
    parent_user_id: rootId,
    phone_verified: true,
    phone_verified_at: new Date().toISOString(),
    is_business: true,
  });
  if (ie) {
    await supabaseAdmin.auth.admin.deleteUser(newId);
    return { ok: false, error: "save_failed" };
  }
  const { error: pe } = await supabaseAdmin.from("business_profiles").insert({
    user_id: newId,
    sponsor_id: String(sponsor.id),
    country_id: sponsor.country_id ?? null,
    region_id: (root as any).region_id ?? null,
    name,
    phone: prefill.phone || null,
    email: prefill.email || null,
    verified: true, // синяя галочка сразу: партнёр уже подтверждён в CRM
  });
  if (pe) {
    await supabaseAdmin.from("users").delete().eq("id", newId);
    await supabaseAdmin.auth.admin.deleteUser(newId);
    return { ok: false, error: "save_failed" };
  }
  try {
    await autoFollowOfficial(newId, (root as any).region_id as string);
  } catch {}
  return { ok: true, userId: newId };
}
