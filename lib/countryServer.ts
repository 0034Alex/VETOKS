import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Серверные помощники: к какой стране относится человек / участница.
export async function countryOfRegion(regionId: string | null | undefined): Promise<string | null> {
  if (!regionId) return null;
  const { data } = await supabaseAdmin.from("regions").select("country_id").eq("id", regionId).maybeSingle();
  return (data?.country_id as string) ?? null;
}

export async function countryOfUser(uid: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
  return countryOfRegion(data?.region_id as string | null);
}

export async function regionIdsOfCountry(countryId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("regions").select("id").eq("country_id", countryId);
  return (data ?? []).map((r: any) => r.id as string);
}

// true, если обе стороны из одной страны (или страна одной из них не определена —
// например, сотрудник без региона).
export async function sameCountry(a: string, b: string): Promise<boolean> {
  const [ca, cb] = await Promise.all([countryOfUser(a), countryOfUser(b)]);
  if (!ca || !cb) return true;
  return ca === cb;
}
