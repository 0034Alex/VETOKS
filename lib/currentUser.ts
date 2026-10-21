import { supabase } from "@/lib/supabaseClient";
import { postJson } from "@/lib/authClient";

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
  telegram_id?: string | number | null;
  region_changed_at?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  birth_date?: string | null;
  age_category?: string | null;
  is_official?: boolean | null;
  regions: { name: string } | null;
};

// Личные данные (телефон, почта, роль) отдаёт только наш сервер и только владельцу.
// Запрос один на несколько вызовов подряд: страницы зовут эту функцию часто.
let cache: { uid: string; at: number; p: Promise<CurrentUser | null> } | null = null;

export function resetCurrentUserCache() {
  cache = null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s) {
    cache = null;
    return null;
  }
  if (cache && cache.uid === s.user.id && Date.now() - cache.at < 4000) return cache.p;
  const p = (async () => {
    const r = await postJson("/api/me", {}, s.access_token);
    return r && r.ok && r.user ? (r.user as CurrentUser) : null;
  })();
  cache = { uid: s.user.id, at: Date.now(), p };
  return p;
}

export async function signOutUser() {
  cache = null;
  await supabase.auth.signOut();
}

export function isStaff(user: CurrentUser | null): boolean {
  if (!user) return false;
  return ["moderator", "finance_admin", "super_admin"].includes(user.role);
}
