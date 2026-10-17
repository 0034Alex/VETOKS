import { supabase } from "@/lib/supabaseClient";

// Страна, с которой сейчас работает CRM. Пусто = «общие настройки для всех стран».
const KEY = "crm_country";

export function getCrmCountry(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setCrmCountry(id: string) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {}
}

// Регионы выбранной в CRM страны. null — страна не выбрана, показываем всё.
export async function crmRegionIds(): Promise<string[] | null> {
  const c = getCrmCountry();
  if (!c) return null;
  const { data } = await supabase.from("regions").select("id").eq("country_id", c);
  return (data ?? []).map((r: { id: string }) => r.id);
}
