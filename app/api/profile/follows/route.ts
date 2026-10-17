import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfUser, regionIdsOfCountry, sameCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Списки «Подписчики» и «Подписки». Владелец видит всегда, остальные — только если он не закрыл их в «Настройках → Приватность».
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const target = String(b.userId || me);
  const kind = b.kind === "following" ? "following" : "followers";
  const isSelf = target === me;
  if (!isSelf && !(await sameCountry(me, target))) return bad("not_found", 404);

  const { data: u } = await supabaseAdmin.from("users").select("privacy").eq("id", target).maybeSingle();
  if (!u) return bad("not_found", 404);
  const priv = ((u.privacy ?? {}) as Record<string, boolean>) || {};
  if (!isSelf && priv.follows === false) return NextResponse.json({ ok: true, hidden: true, items: [] });

  const cid = await countryOfUser(me);
  const regionIds = cid ? await regionIdsOfCountry(cid) : [];

  if (kind === "followers") {
    const { data: part } = await supabaseAdmin.from("participants").select("id").eq("user_id", target).maybeSingle();
    if (!part) return NextResponse.json({ ok: true, items: [] });
    const { data: rows } = await supabaseAdmin
      .from("participant_follows")
      .select("user_id")
      .eq("participant_id", part.id)
      .limit(300);
    const ids = (rows ?? []).map((r: any) => r.user_id);
    if (!ids.length) return NextResponse.json({ ok: true, items: [] });
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, first_name, nick, photo_url, is_banned, region_id")
      .in("id", ids);
    const items = (users ?? [])
      .filter((x: any) => !x.is_banned && (!regionIds.length || regionIds.includes(x.region_id)))
      .map((x: any) => ({ href: `/u/${x.id}`, name: x.first_name || "Без имени", sub: x.nick ? `@${x.nick}` : "", photo: x.photo_url ?? null }));
    return NextResponse.json({ ok: true, items });
  }

  const { data: rows } = await supabaseAdmin.from("participant_follows").select("participant_id").eq("user_id", target).limit(300);
  const pids = (rows ?? []).map((r: any) => r.participant_id);
  if (!pids.length) return NextResponse.json({ ok: true, items: [] });
  const { data: parts } = await supabaseAdmin
    .from("participants")
    .select("id, display_name, photo_url, region_id")
    .in("id", pids);
  const items = (parts ?? [])
    .filter((x: any) => !regionIds.length || regionIds.includes(x.region_id))
    .map((x: any) => ({ href: `/participant/${x.id}`, name: x.display_name, sub: "Участница", photo: x.photo_url ?? null }));
  return NextResponse.json({ ok: true, items });
}
