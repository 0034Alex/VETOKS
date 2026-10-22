import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Афиши участниц: в какой Telegram-чат отправлять готовые афиши (настраивается в CRM → «Афіші»).
export const POSTER_CATS = ["teen", "main", "adult"] as const;
export type PosterCategory = (typeof POSTER_CATS)[number];
export const POSTER_CAT_LABEL: Record<string, string> = {
  teen: "MISS TEEN 15–17",
  main: "MISS 18–29",
  adult: "LADY 30+",
};

export const posterKey = (cat: string) => `poster_chat_${cat}`;

export async function posterChat(cat: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", posterKey(cat)).maybeSingle();
  const v = String((data as any)?.value ?? "").trim();
  return v || null;
}

export async function posterChats(): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", POSTER_CATS.map(posterKey));
  const out: Record<string, string> = {};
  POSTER_CATS.forEach((c) => (out[c] = ""));
  ((data ?? []) as any[]).forEach((r) => {
    const c = String(r.key).replace("poster_chat_", "");
    out[c] = String(r.value ?? "");
  });
  return out;
}

async function tg(method: string, body: object): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "Нет токена бота (TELEGRAM_BOT_TOKEN)." };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j: any = await r.json().catch(() => ({}));
    if (j?.ok) return { ok: true };
    return { ok: false, error: String(j?.description || "Telegram не принял сообщение") };
  } catch {
    return { ok: false, error: "Не удалось связаться с Telegram." };
  }
}

// Готовая афиша уходит файлом (документом): так в Telegram сохраняется полное качество.
export function sendPosterToTg(chatId: string, imageUrl: string, caption: string) {
  return tg("sendDocument", { chat_id: chatId, document: imageUrl, caption: caption.slice(0, 1000) });
}

export function sendTgText(chatId: string, text: string) {
  return tg("sendMessage", { chat_id: chatId, text });
}

export function ageFromBirth(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}

export function splitName(full: string): { first: string; last: string } {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

// Данные для афиши: имя, возраст, город, страна, категория.
export async function posterProfile(uid: string) {
  const { data: part } = await supabaseAdmin
    .from("participants")
    .select("id, display_name")
    .eq("user_id", uid)
    .maybeSingle();
  if (!part) return null;
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("birth_date, age_category, region_id, regions(name, country_id)")
    .eq("id", uid)
    .maybeSingle();
  const reg: any = Array.isArray((u as any)?.regions) ? (u as any).regions[0] : (u as any)?.regions;
  let country = "";
  if (reg?.country_id) {
    const { data: c } = await supabaseAdmin.from("countries").select("name").eq("id", reg.country_id).maybeSingle();
    country = String((c as any)?.name ?? "");
  }
  const { first, last } = splitName((part as any).display_name);
  return {
    participantId: (part as any).id as string,
    name: String((part as any).display_name ?? ""),
    first,
    last,
    age: ageFromBirth((u as any)?.birth_date),
    cat: ((u as any)?.age_category as string) || "main",
    city: String(reg?.name ?? ""),
    country,
  };
}
