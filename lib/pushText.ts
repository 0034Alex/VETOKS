import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Язык сообщений бота — тот, что человек выбрал в настройках приложения.
export async function pickText(userId: string, t: { ru: string; uk: string; en: string }): Promise<string> {
  const { data } = await supabaseAdmin.from("users").select("language").eq("id", userId).maybeSingle();
  const l = String(data?.language ?? "uk");
  if (l === "ru") return t.ru;
  if (l === "uk") return t.uk;
  return t.en;
}
