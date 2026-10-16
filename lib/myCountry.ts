import { supabase } from "@/lib/supabaseClient";

// Страна текущего пользователя и список её регионов. Нужна, чтобы одна страна
// не видела участниц, рейтинги и ленты другой.
export type MyCountry = { countryId: string | null; regionIds: string[] };

const EMPTY: MyCountry = { countryId: null, regionIds: [] };
let cache: { uid: string; at: number; value: MyCountry } | null = null;

export function resetMyCountry() {
  cache = null;
}

export async function getMyCountry(): Promise<MyCountry> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return EMPTY;
    if (cache && cache.uid === uid && Date.now() - cache.at < 60_000) return cache.value;
    const { data: u } = await supabase.from("users").select("region_id").eq("id", uid).maybeSingle();
    if (!u?.region_id) return EMPTY;
    const { data: rg } = await supabase.from("regions").select("country_id").eq("id", u.region_id).maybeSingle();
    if (!rg?.country_id) return EMPTY;
    const { data: rs } = await supabase.from("regions").select("id").eq("country_id", rg.country_id);
    const value: MyCountry = { countryId: rg.country_id as string, regionIds: (rs ?? []).map((r: any) => r.id as string) };
    cache = { uid, at: Date.now(), value };
    return value;
  } catch {
    return EMPTY;
  }
}
