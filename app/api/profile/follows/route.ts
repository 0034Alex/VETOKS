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

  const userItems = async (ids: string[]) => {
    if (!ids.length) return [] as any[];
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, first_name, nick, photo_url, is_banned, region_id")
      .in("id", ids);
    return (users ?? [])
      .filter((x: any) => !x.is_banned && (!regionIds.length || regionIds.includes(x.region_id)))
      .map((x: any) => ({ href: `/u/${x.id}`, name: x.first_name || "Без имени", sub: x.nick ? `@${x.nick}` : "", photo: x.photo_url ?? null }));
  };

  const { data: part } = await supabaseAdmin.from("participants").select("id").eq("user_id", target).maybeSingle();

  if (kind === "followers") {
    let ids: string[] = [];
    if (part) {
      const { data: rows } = await supabaseAdmin.from("participant_follows").select("user_id").eq("participant_id", part.id).limit(300);
      ids = (rows ?? []).map((r: any) => r.user_id);
    }
    const { data: uf } = await supabaseAdmin.from("user_follows").select("follower_id").eq("followed_id", target).limit(300);
    ids = Array.from(new Set([...ids, ...(uf ?? []).map((r: any) => r.follower_id as string)]));
    return NextResponse.json({ ok: true, items: await userItems(ids) });
  }

  // Подписки: участницы (старый способ) и обычные люди.
  const { data: rows } = await supabaseAdmin.from("participant_follows").select("participant_id").eq("user_id", target).limit(300);
  const pids = (rows ?? []).map((r: any) => r.participant_id);
  let items: any[] = [];
  if (pids.length) {
    const { data: parts } = await supabaseAdmin.from("participants").select("id, display_name, photo_url, region_id").in("id", pids);
    items = (parts ?? [])
      .filter((x: any) => !regionIds.length || regionIds.includes(x.region_id))
      .map((x: any) => ({ href: `/participant/${x.id}`, name: x.display_name, sub: "Участница", photo: x.photo_url ?? null }));
  }
  const { data: uf2 } = await supabaseAdmin.from("user_follows").select("followed_id").eq("follower_id", target).limit(300);
  items = items.concat(await userItems((uf2 ?? []).map((r: any) => r.followed_id as string)));
  return NextResponse.json({ ok: true, items });
}
