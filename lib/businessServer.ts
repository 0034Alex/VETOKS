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
