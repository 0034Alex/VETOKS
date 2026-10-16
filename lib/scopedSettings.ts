import { supabase } from "@/lib/supabaseClient";

// Настройки платформы по странам. У каждой страны свои значения под ключом
// "<ключ>:<id страны>"; если для страны ничего не задано — берётся общее
// значение без суффикса.
// Третий уровень — область: "<ключ>:<id страны>:<id области>" (бегущая строка, окно при входе).
export function scopedKey(key: string, countryId: string | null | undefined, regionId?: string | null): string {
  if (countryId && regionId) return `${key}:${countryId}:${regionId}`;
  return countryId ? `${key}:${countryId}` : key;
}

// Приоритет: область → страна → общее значение.
export async function loadScoped(
  keys: string[],
  countryId: string | null | undefined,
  regionId?: string | null
): Promise<Record<string, string>> {
  const all = [...keys];
  if (countryId) keys.forEach((k) => all.push(scopedKey(k, countryId)));
  if (countryId && regionId) keys.forEach((k) => all.push(scopedKey(k, countryId, regionId)));
  const { data } = await supabase.from("platform_settings").select("key, value").in("key", all);
  const raw: Record<string, string> = {};
  (data ?? []).forEach((s: { key: string; value: string | null }) => {
    if (s.value !== null && s.value !== undefined) raw[s.key] = s.value;
  });
  const out: Record<string, string> = {};
  keys.forEach((k) => {
    const reg = countryId && regionId ? raw[scopedKey(k, countryId, regionId)] : undefined;
    const own = countryId ? raw[scopedKey(k, countryId)] : undefined;
    if (reg !== undefined) out[k] = reg;
    else if (own !== undefined) out[k] = own;
    else if (raw[k] !== undefined) out[k] = raw[k];
  });
  return out;
}

// Только значение самой страны (для CRM: что именно задано для этой страны).
export async function loadOwn(keys: string[], countryId: string | null | undefined): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", keys.map((k) => scopedKey(k, countryId)));
  const out: Record<string, string> = {};
  (data ?? []).forEach((s: { key: string; value: string | null }) => {
    const base = countryId ? s.key.slice(0, s.key.length - countryId.length - 1) : s.key;
    if (s.value !== null && s.value !== undefined) out[base] = s.value;
  });
  return out;
}

// Только значение самой области (для CRM).
export async function loadOwnRegion(keys: string[], countryId: string, regionId: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", keys.map((k) => scopedKey(k, countryId, regionId)));
  const out: Record<string, string> = {};
  (data ?? []).forEach((s: { key: string; value: string | null }) => {
    const base = s.key.slice(0, s.key.length - countryId.length - regionId.length - 2);
    if (s.value !== null && s.value !== undefined) out[base] = s.value;
  });
  return out;
}
