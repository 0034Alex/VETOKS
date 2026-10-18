import { clientIp } from "@/lib/rateLimit";

// Проверка капчи Cloudflare Turnstile на сервере.
// Пока ключ TURNSTILE_SECRET_KEY не задан — капча выключена, людей не блокируем.
export function captchaConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(token: unknown, req: Request): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const t = typeof token === "string" ? token : "";
  if (!t || t.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: t, remoteip: clientIp(req) });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const j = await r.json();
    return !!j?.success;
  } catch {
    // Если сам Cloudflare недоступен — не закрываем регистрацию всем честным людям.
    return true;
  }
}
