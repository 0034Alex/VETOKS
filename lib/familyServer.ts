import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const MAX_SUB_ACCOUNTS = 2; // основной + 2 дополнительных = 3

export type FamilyMember = {
  id: string;
  first_name: string | null;
  parent_user_id: string | null;
  is_banned: boolean;
  is_business?: boolean | null;
};

// Главный аккаунт «семьи»: для основного это он сам, для дополнительного — родитель.
export async function familyRootId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, parent_user_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return (data.parent_user_id as string | null) ?? (data.id as string);
}

// Основной аккаунт + его дополнительные, основной первым.
export async function familyMembers(rootId: string): Promise<FamilyMember[]> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, first_name, parent_user_id, is_banned, is_business, created_at")
    .or(`id.eq.${rootId},parent_user_id.eq.${rootId}`)
    .order("created_at", { ascending: true });
  const list = (data ?? []) as any[];
  list.sort((a, b) => (a.id === rootId ? -1 : b.id === rootId ? 1 : 0));
  return list as FamilyMember[];
}
