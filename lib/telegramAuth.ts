import { createHmac, timingSafeEqual } from "crypto";

export type TgUser = {
  id: number;
  first_name?: string;
  username?: string;
};

// Проверяет подпись данных, которые Telegram передаёт мини-приложению
// (initData). Только так можно быть уверенным, что человек действительно
// тот, кем назвался. Работает только на сервере.
export function verifyInitData(
  initData: string,
  maxAgeSec = 60 * 60 * 24,
  tokenOverride?: string
): TgUser | null {
  const botToken = tokenOverride ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const a = Buffer.from(calc, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "");
    if (!user?.id) return null;
    return user as TgUser;
  } catch {
    return null;
  }
}

// То же, но подпись может быть от любого из ботов (общий или бот страны из CRM).
export async function verifyInitDataAny(initData: string, maxAgeSec = 60 * 60 * 24): Promise<TgUser | null> {
  const { allBotTokens } = await import("@/lib/countryBot");
  for (const t of await allBotTokens()) {
    const u = verifyInitData(initData, maxAgeSec, t);
    if (u) return u;
  }
  return null;
}
