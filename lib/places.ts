import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser } from "@/lib/countryServer";

export function placeKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Находит место по названию в стране или создаёт (одно и то же место = одна запись).
export async function resolvePlace(uid: string, placeId: unknown, placeName: unknown): Promise<string | null> {
  const country = await countryOfUser(uid);
  if (placeId) {
    const { data } = await supabaseAdmin.from("places").select("id, country_id").eq("id", String(placeId)).maybeSingle();
    if (data && (!country || !data.country_id || data.country_id === country)) return data.id as string;
    return null;
  }
  const name = String(placeName ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (name.length < 2) return null;
  const key = placeKey(name);
  let q = supabaseAdmin.from("places").select("id").eq("name_key", key);
  q = country ? q.eq("country_id", country) : q.is("country_id", null);
  const { data: ex } = await q.maybeSingle();
  if (ex) return ex.id as string;
  const { data: ins } = await supabaseAdmin
    .from("places")
    .insert({ country_id: country, name, name_key: key, created_by: uid })
    .select("id")
    .maybeSingle();
  return (ins?.id as string) ?? null;
}

