import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Показы и просмотры пачкой (телефон шлёт раз в ~20 секунд и при выходе со страницы).
// События: i — показано, q — досмотрено больше 10 секунд, c — до конца, s — поделился.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const uid = await userIdFromBearer(req);
  const device = typeof b.device === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.device) ? b.device : "";
  const viewer = uid ?? (device ? `d:${device}` : "");
  if (!viewer) return NextResponse.json({ ok: false }, { status: 400 });
  const rl = await rateLimit(req, "media/events", 60, 60, viewer);
  if (rl) return rl;

  const raw: any[] = Array.isArray(b.events) ? b.events.slice(0, 40) : [];
  const seen = new Set<string>();
  let events = raw
    .filter((e) => e && typeof e.p === "string" && UUID.test(e.p) && !seen.has(e.p) && seen.add(e.p))
    .map((e) => ({ p: e.p as string, i: !!e.i, q: !!e.q, c: !!e.c, s: !!e.s }));
  if (!events.length) return NextResponse.json({ ok: true });

  // свои ролики не считаем
  if (uid) {
    const { data: me } = await supabaseAdmin.from("participants").select("id").eq("user_id", uid).maybeSingle();
    if (me?.id) {
      const { data: own } = await supabaseAdmin.from("content_posts").select("id").eq("participant_id", me.id).in("id", events.map((e) => e.p));
      const ownSet = new Set((own ?? []).map((o: any) => o.id as string));
      events = events.filter((e) => !ownSet.has(e.p));
    }
  }
  // гости и аккаунты младше суток: только показы, без досмотров и репостов (против накрутки)
  let trusted = false;
  if (uid) {
    const { data: u } = await supabaseAdmin.from("users").select("created_at").eq("id", uid).maybeSingle();
    trusted = !!u?.created_at && Date.now() - new Date(u.created_at as string).getTime() > 24 * 3600 * 1000;
  }
  if (!trusted) events = events.map((e) => ({ ...e, q: false, c: false, s: false }));
  if (!events.length) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin.rpc("media_apply_events", { p_viewer: viewer, p_events: events });
  return NextResponse.json({ ok: !error });
}
