import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "VETOKS_bot";

export function tgEmail(telegramId: string | number) {
  return `tg${telegramId}@tg.vetoks.app`;
}

export function newToken() {
  return randomBytes(16).toString("hex");
}

// Выдаёт одноразовый ключ, по которому браузер откроет сессию этого человека.
export async function tokenHashForUser(userId: string): Promise<string | null> {
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return null;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) return null;
  return data.properties.hashed_token;
}

export async function userIdFromBearer(req: Request): Promise<string | null> {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user?.id ?? null;
}

export async function findUserByTelegramId(telegramId: string | number) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, is_banned")
    .eq("telegram_id", String(telegramId))
    .limit(1)
    .maybeSingle();
  return data as { id: string; is_banned: boolean } | null;
}
