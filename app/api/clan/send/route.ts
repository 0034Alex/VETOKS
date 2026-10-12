import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Запрещаем ссылки и адреса сайтов/каналов — в клане только текст.
const LINK_RE = /(https?:|www\.|t\.me|tg:\/\/|@[a-z0-9_]{4,}|\b[a-z0-9-]+\.(com|ru|ua|net|org|info|me|io|xyz|ly|gl|cc|top|site|online|link|bio)\b)/i;

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return bad("empty");
  if (text.length > 500) return bad("long");
  if (LINK_RE.test(text)) return bad("links");

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("region_id, phone_verified, clan_muted_until")
    .eq("id", uid)
    .maybeSingle();
  if (!u?.region_id) return bad("no_region");
  if (!u.phone_verified) return bad("verify", 403);
  if (u.clan_muted_until && new Date(u.clan_muted_until) > new Date()) {
    return bad("muted", 403, { until: u.clan_muted_until });
  }

  const now = Date.now();
  const { data: recent } = await supabaseAdmin
    .from("region_clan_messages")
    .select("created_at")
    .eq("user_id", uid)
    .gte("created_at", new Date(now - 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  const list = recent ?? [];
  if (list.length >= 30) return bad("rate_hour", 429);
  if (list[0] && now - new Date(list[0].created_at).getTime() < 10_000) return bad("rate_10s", 429);

  const { error } = await supabaseAdmin
    .from("region_clan_messages")
    .insert({ region_id: u.region_id, user_id: uid, body: text });
  if (error) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
