import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser } from "@/lib/countryServer";

// Telegram-бот страны. Если для страны бот не задан в CRM — общий бот (переменные окружения).
export type Bot = { token: string; username: string; custom: boolean };
type Row = { country_id: string; bot_username: string | null; bot_token: string | null; channel_link: string | null; channel_chat: string | null };

// Бот только у страны (задаётся в CRM). Нет бота у страны — токен и имя пустые, сообщений в Telegram нет.
const none = (): Bot => ({ token: "", username: "", custom: false });

let cache: { at: number; rows: Row[] } | null = null;
async function rows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.rows;
  const { data, error } = await supabaseAdmin.from("country_bots").select("country_id, bot_username, bot_token, channel_link, channel_chat");
  const r = error ? [] : ((data as Row[]) ?? []);
  cache = { at: Date.now(), rows: r };
  return r;
}
export function resetBotCache() {
  cache = null;
}

export async function botForCountry(countryId: string | null | undefined): Promise<Bot> {
  if (!countryId) return none();
  const r = (await rows()).find((x) => x.country_id === countryId && x.bot_token);
  return r ? { token: r.bot_token as string, username: String(r.bot_username || "").replace(/^@/, "") || "", custom: true } : none();
}

export async function botForUser(userId: string): Promise<Bot> {
  return botForCountry(await countryOfUser(userId));
}

// Токены ботов всех стран: нужны, чтобы проверить подпись входа из мини-приложения.
export async function allBotTokens(): Promise<string[]> {
  const out = new Set<string>();
  (await rows()).forEach((r) => r.bot_token && out.add(r.bot_token));
  return Array.from(out);
}

// Официальный канал страны (ссылка и чат для публикаций).
export async function channelOfCountry(countryId: string | null | undefined): Promise<{ link: string; chat: string } | null> {
  if (!countryId) return null;
  const r = (await rows()).find((x) => x.country_id === countryId);
  if (!r || (!r.channel_link && !r.channel_chat)) return null;
  return { link: r.channel_link || "", chat: r.channel_chat || "" };
}

// Сообщение в официальный канал страны (только её, и только её ботом).
export async function postToCountryChannel(countryId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const ch = await channelOfCountry(countryId);
  if (!ch?.chat) return { ok: false, error: "У страны не задан чат канала." };
  const bot = await botForCountry(countryId);
  if (!bot.token) return { ok: false, error: "У страны нет бота." };
  try {
    const r = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ch.chat, text }),
    });
    const j: any = await r.json().catch(() => ({}));
    return j?.ok ? { ok: true } : { ok: false, error: String(j?.description || "Telegram не принял сообщение") };
  } catch {
    return { ok: false, error: "Не удалось связаться с Telegram." };
  }
}
