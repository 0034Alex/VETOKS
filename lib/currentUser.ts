import { supabase } from "@/lib/supabaseClient";

export type CurrentUser = {
  id: string;
  first_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  email: string | null;
  region_id: string | null;
  referral_code: string;
  role: string;
  is_banned: boolean;
  permissions: Record<string, boolean | string> | null;
  staff_countries?: string[] | null;
  region_pending?: boolean | null;
  regions: { name: string } | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData?.user;
  if (!authUser) return null;

  const { data } = await supabase
    .from("users")
    .select(
      "id, first_name, phone, phone_verified, email, region_id, referral_code, role, is_banned, permissions, staff_countries, region_pending, regions(name)"
    )
    .eq("id", authUser.id)
    .maybeSingle();

  if (!data) return null;

  // Фиксируем заход — не блокируя основной запрос.
  supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", authUser.id)
    .then(() => {});

  return data as unknown as CurrentUser;
}

export async function signOutUser() {
  await supabase.auth.signOut();
}

export function isStaff(user: CurrentUser | null): boolean {
  if (!user) return false;
  return ["moderator", "finance_admin", "super_admin"].includes(user.role);
}
