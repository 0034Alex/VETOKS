import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const CONSENT_VERSION = "teen-1";

// Есть ли у несовершеннолетней (TEEN) действующее согласие родителя.
// Для остальных возрастов возвращает true — им согласие не нужно.
export async function parentConsentOk(userId: string): Promise<boolean> {
  const { data: u } = await supabaseAdmin.from("users").select("age_category").eq("id", userId).maybeSingle();
  if ((u as any)?.age_category !== "teen") return true;
  const { data } = await supabaseAdmin
    .from("parental_consents")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .limit(1);
  return (data ?? []).length > 0;
}

export async function isTeenUser(userId: string): Promise<boolean> {
  const { data: u } = await supabaseAdmin.from("users").select("age_category").eq("id", userId).maybeSingle();
  return (u as any)?.age_category === "teen";
}
