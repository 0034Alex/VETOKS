import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { phoneVariants } from "@/lib/phone";

// Находит аккаунт для сброса пароля по почте, номеру или Telegram-id.
export async function findUserForReset(b: any): Promise<{ id: string; telegram_id: string | null } | null> {
  const ident = String(b?.identifier ?? "").trim();
  if (ident && ident.length <= 120) {
    let q = supabaseAdmin.from("users").select("id, telegram_id").limit(1);
    q = ident.includes("@") ? q.eq("email", ident.toLowerCase()) : q.in("phone", phoneVariants(ident));
    const { data } = await q.maybeSingle();
    if (data) return { id: data.id as string, telegram_id: (data.telegram_id as string) ?? null };
    return null;
  }
  const tg = b?.telegram_id ? String(b.telegram_id) : "";
  if (tg && /^\d{4,20}$/.test(tg)) {
    const { data } = await supabaseAdmin.from("users").select("id, telegram_id").eq("telegram_id", tg).limit(1).maybeSingle();
    if (data) return { id: data.id as string, telegram_id: (data.telegram_id as string) ?? null };
  }
  return null;
}
