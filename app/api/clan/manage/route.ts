import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { hasBadWords } from "@/lib/badWords";

export const dynamic = "force-dynamic";

// В клане только текст, без ссылок и адресов (как при отправке).
const LINK_RE = /(https?:|www\.|t\.me|tg:\/\/|@[a-z0-9_]{4,}|\b[a-z0-9-]+\.(com|ru|ua|net|org|info|me|io|xyz|ly|gl|cc|top|site|online|link|bio)\b)/i;

// Своё сообщение в клане: изменить или удалить. Удалённое скрывается (модератор по жалобе всё равно его видит).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "clan/manage", 30, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return bad("empty");

  const { data: m } = await supabaseAdmin.from("region_clan_messages").select("id, user_id").eq("id", id).maybeSingle();
  if (!m || (m as any).user_id !== uid) return bad("forbidden", 403);

  if (b.action === "delete") {
    const { error } = await supabaseAdmin.from("region_clan_messages").update({ is_hidden: true }).eq("id", id);
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "edit") {
    const text = String(b.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) return bad("empty");
    if (text.length > 500) return bad("long");
    if (LINK_RE.test(text)) return bad("links");
    if (hasBadWords(text)) return bad("bad_words");
    const { data: u } = await supabaseAdmin.from("users").select("clan_muted_until").eq("id", uid).maybeSingle();
    if ((u as any)?.clan_muted_until && new Date((u as any).clan_muted_until) > new Date()) return bad("muted", 403);
    const { error } = await supabaseAdmin.from("region_clan_messages").update({ body: text, edited_at: new Date().toISOString() }).eq("id", id);
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true });
  }

  return bad("bad_action");
}
