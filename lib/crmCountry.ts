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
