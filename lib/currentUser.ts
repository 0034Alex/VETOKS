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
  regions: { name: string } | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const tgId = getTelegramId();
  const deviceId = getDeviceId();

  if (tgId) {
    const { data } = await supabase
      .from("users")
      .select("id, first_name, region_id, referral_code, regions(name)")
      .eq("telegram_id", tgId)
      .maybeSingle();
    if (data) return data as unknown as CurrentUser;
  }

  if (deviceId) {
    const { data } = await supabase
      .from("users")
      .select("id, first_name, region_id, referral_code, regions(name)")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (data) return data as unknown as CurrentUser;
  }

  return null;
}
