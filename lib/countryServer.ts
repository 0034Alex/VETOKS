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

// Символ валюты страны человека (₴ для Украины) — для уведомлений и сообщений бота.
export async function currencyOfUser(uid: string): Promise<string> {
  const cid = await countryOfUser(uid);
  if (!cid) return "₴";
  const { data } = await supabaseAdmin.from("countries").select("currency_symbol").eq("id", cid).maybeSingle();
  return ((data as any)?.currency_symbol as string) || "₴";
}

// Настройки платформы по странам: сначала "<ключ>:<id страны>", потом общее "<ключ>".
export async function settingsForCountry(keys: string[], countryId: string | null): Promise<Record<string, string>> {
  const all = [...keys];
  if (countryId) keys.forEach((k) => all.push(`${k}:${countryId}`));
  const { data } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", all);
  const raw: Record<string, string> = {};
  (data ?? []).forEach((r: any) => {
    if (r.value !== null && r.value !== undefined) raw[r.key] = r.value;
  });
  const out: Record<string, string> = {};
  keys.forEach((k) => {
    const own = countryId ? raw[`${k}:${countryId}`] : undefined;
    if (own !== undefined) out[k] = own;
    else if (raw[k] !== undefined) out[k] = raw[k];
  });
  return out;
}
