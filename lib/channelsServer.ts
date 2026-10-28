import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trServer } from "@/lib/serverI18n";

export type Ch = {
  id: string; owner_id: string; slug: string; name: string; descr: string; photo_url: string | null;
  kind: "open" | "closed" | "hidden"; subs_count: number; frozen: boolean; pinned_post_id: string | null; created_at: string;
};

export const EMOJIS = ["❤️", "🔥", "👍", "😍", "😂", "👏"];
export const LINK_RE = /(https?:\/\/|www\.|t\.me\/|[a-z0-9-]+\.(com|ua|ru|me|net|org|io|app|xyz|info)\b)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cleanSlug = (s: string) => String(s || "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 32);
export const slugOk = (s: string) => /^[a-z0-9_]{3,32}$/.test(s) && !["new", "admin", "vetoks", "support", "api"].includes(s);

export async function getChannel(key: string): Promise<Ch | null> {
  const k = String(key || "").trim();
  if (!k) return null;
  const q = supabaseAdmin.from("channels").select("*");
  const { data } = UUID.test(k) ? await q.eq("id", k).maybeSingle() : await q.eq("slug", cleanSlug(k)).maybeSingle();
  return (data as Ch) ?? null;
}

export async function memberStatus(chId: string, uid: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("channel_members").select("status").eq("channel_id", chId).eq("user_id", uid).maybeSingle();
  return (data?.status as string) ?? null;
}

export async function userFlags(uid: string): Promise<{ teen: boolean; isNew: boolean }> {
  const { data } = await supabaseAdmin.from("users").select("age_category, created_at").eq("id", uid).maybeSingle();
  const created = data?.created_at ? new Date(data.created_at as string).getTime() : 0;
  return { teen: (data as any)?.age_category === "teen", isNew: !created || Date.now() - created < 86400_000 };
}

// Рассылка о новом посте: в приложении и (если включено) от бота. Отдельные переключатели в настройках.
export async function fanoutPost(ch: Ch, postId: string, preview: string, ownerId: string) {
  const { data: mem } = await supabaseAdmin
    .from("channel_members").select("user_id").eq("channel_id", ch.id).eq("status", "member").eq("muted", false).neq("user_id", ownerId).limit(5000);
  const ids = (mem ?? []).map((m: any) => m.user_id as string);
  if (!ids.length) return;
  const msg = `Новый пост в канале «${ch.name}»` + (preview ? `: ${preview.slice(0, 80)}` : "");
  const link = `/channels/${ch.id}#p${postId}`;
  const { botForCountry } = await import("@/lib/countryBot");
  const { countryOfUser } = await import("@/lib/countryServer");
  const token = (await botForCountry(await countryOfUser(ownerId))).token;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { data: us } = await supabaseAdmin.from("users").select("id, telegram_id, notify_tg, language").in("id", chunk);
    const rows: any[] = [];
    const tg: { chat: string; lang: string }[] = [];
    for (const u of (us ?? []) as any[]) {
      const p = (u.notify_tg ?? {}) as Record<string, boolean>;
      if (p.ch_app !== false) rows.push({ user_id: u.id, message: msg, link });
      if (token && u.telegram_id && p.ch_tg === true) tg.push({ chat: String(u.telegram_id), lang: u.language });
    }
    if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
    const base = `https://t.me/`; void base;
    for (let j = 0; j < tg.length && j < 400; j += 20) {
      await Promise.all(
        tg.slice(j, j + 20).map((x) =>
          fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: x.chat, text: trServer(x.lang, msg) }),
          }).catch(() => {})
        )
      );
    }
  }
}
