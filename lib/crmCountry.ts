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

// Символ валюты страны, выбранной в CRM (₴ для Украины). Страна меняется
// перезагрузкой страницы, поэтому достаточно загрузить один раз при входе.
export let crmCur = "₴";

export async function loadCrmCur(): Promise<string> {
  try {
    const c = getCrmCountry();
    let sym: string | null = null;
    if (c) {
      const { data } = await supabase.from("countries").select("currency_symbol").eq("id", c).maybeSingle();
      sym = (data as any)?.currency_symbol ?? null;
    }
    if (!sym) {
      const { data } = await supabase.from("countries").select("currency_symbol").eq("enabled", true).limit(1).maybeSingle();
      sym = (data as any)?.currency_symbol ?? null;
    }
    crmCur = sym || "₴";
  } catch {
    crmCur = "₴";
  }
  return crmCur;
}
