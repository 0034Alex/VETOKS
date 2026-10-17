import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { countryOfUser, regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Кому отправить публикацию: без запроса — недавние переписки и те, на кого я подписан;
// с запросом — поиск по имени или нику среди людей своей страны.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const q = String(body.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 30);
  const myCountry = await countryOfUser(me);
  const regionIds = myCountry ? await regionIdsOfCountry(myCountry) : null;

  let ids: string[] = [];
  let recentCount = 0;

  if (q.length >= 2) {
    const nickQ = q.toLowerCase().replace(/^@/, "");
    let uq = supabaseAdmin
      .from("users")
      .select("id")
      .or(`first_name.ilike.%${q}%,nick.ilike.${nickQ}%`)
      .eq("is_banned", false)
      .neq("id", me);
    if (regionIds) uq = uq.in("region_id", regionIds);
    const { data } = await uq.limit(15);
    ids = (data ?? []).map((u: any) => u.id);
  } else {
    const { data: th } = await supabaseAdmin
      .from("dm_threads")
      .select("user_a, user_b, last_at")
      .or(`user_a.eq.${me},user_b.eq.${me}`)
      .order("last_at", { ascending: false })
      .limit(8);
    (th ?? []).forEach((t: any) => ids.push(t.user_a === me ? t.user_b : t.user_a));
    recentCount = ids.length;

    const { data: pf } = await supabaseAdmin.from("participant_follows").select("participant_id").eq("user_id", me).limit(20);
    const pids = (pf ?? []).map((x: any) => x.participant_id);
    if (pids.length) {
      const { data: ps } = await supabaseAdmin.from("participants").select("user_id").in("id", pids);
      (ps ?? []).forEach((p: any) => p.user_id && ids.push(p.user_id));
    }
    const { data: uf } = await supabaseAdmin.from("user_follows").select("followed_id").eq("follower_id", me).limit(20);
    (uf ?? []).forEach((x: any) => ids.push(x.followed_id));
  }

  ids = Array.from(new Set(ids)).filter((id) => id && id !== me).slice(0, q.length >= 2 ? 15 : 16);
  if (!ids.length) return NextResponse.json({ ok: true, items: [] });

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, first_name, nick, photo_url, privacy, is_banned, region_id")
    .in("id", ids);
  const { data: parts } = await supabaseAdmin.from("participants").select("user_id, photo_url").in("user_id", ids);
  const pPhoto: Record<string, string> = {};
  (parts ?? []).forEach((p: any) => p.photo_url && (pPhoto[p.user_id] = p.photo_url));
  const byId: Record<string, any> = {};
  (users ?? []).forEach((u: any) => (byId[u.id] = u));

  const items = ids
    .map((id, i) => ({ u: byId[id], recent: i < recentCount }))
    .filter(({ u }) => u && !u.is_banned && (u.privacy as any)?.dm !== false && (!regionIds || regionIds.includes(u.region_id)))
    .map(({ u, recent }) => ({
      id: u.id as string,
      name: (u.first_name as string) || (u.nick as string) || "Гость",
      nick: (u.nick as string) || "",
      photoUrl: pPhoto[u.id] ?? u.photo_url ?? null,
      recent,
    }));
  return NextResponse.json({ ok: true, items });
}
