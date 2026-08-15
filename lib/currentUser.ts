import { supabase } from "@/lib/supabaseClient";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("vetoks_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("vetoks_device_id", id);
  }
  return id;
}

function getTelegramId(): number | null {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
}

export { getDeviceId, getTelegramId };

export type CurrentUser = {
  id: string;
  first_name: string | null;
  region_id: string | null;
  referral_code: string;
  is_banned: boolean;
  regions: { name: string } | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const tgId = getTelegramId();
  const deviceId = getDeviceId();

  let user: CurrentUser | null = null;

  if (tgId) {
    const { data } = await supabase
      .from("users")
      .select("id, first_name, region_id, referral_code, is_banned, regions(name)")
      .eq("telegram_id", tgId)
      .maybeSingle();
    if (data) user = data as unknown as CurrentUser;
  }

  if (!user && deviceId) {
    const { data } = await supabase
      .from("users")
      .select("id, first_name, region_id, referral_code, is_banned, regions(name)")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (data) user = data as unknown as CurrentUser;
  }

  if (user) {
    // Фиксируем заход — не блокируя основной запрос.
    supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {});
  }

  return user;
}
