import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser } from "@/lib/countryServer";
import { preStartHold } from "@/lib/launchServer";

// Видимость публикации: all — все, followers — только подписчики автора, me — только автор.
export type Visibility = "all" | "followers" | "me";
export function cleanVisibility(v: unknown): Visibility {
  return v === "followers" || v === "me" ? v : "all";
}

// На кого из этих авторов смотрящий подписан (человек или участница).
export async function followedOwners(viewer: string, ownerIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = Array.from(new Set(ownerIds.filter(Boolean)));
  if (!ids.length) return out;
  const { data: uf } = await supabaseAdmin
    .from("user_follows")
    .select("followed_id")
    .eq("follower_id", viewer)
    .in("followed_id", ids);
  (uf ?? []).forEach((r: any) => out.add(r.followed_id));
  const { data: parts } = await supabaseAdmin.from("participants").select("id, user_id").in("user_id", ids);
  const pm: Record<string, string> = {};
  (parts ?? []).forEach((p: any) => (pm[p.id] = p.user_id));
  const pids = Object.keys(pm);
  if (pids.length) {
    const { data: pf } = await supabaseAdmin
      .from("participant_follows")
      .select("participant_id")
      .eq("user_id", viewer)
      .in("participant_id", pids);
    (pf ?? []).forEach((r: any) => pm[r.participant_id] && out.add(pm[r.participant_id]));
  }
  return out;
}

// Фильтр списка публикаций под смотрящего.
export async function filterVisible<T>(
  viewer: string,
  rows: T[],
  ownerOf: (r: T) => string | undefined,
  visOf: (r: T) => string | null | undefined
): Promise<T[]> {
  // До старта первого шоу страны чужие ролики не показываем: каждый видит только свои.
  if (await preStartHold(await countryOfUser(viewer))) rows = rows.filter((r) => ownerOf(r) === viewer);
  const need = rows.filter((r) => {
    const v = visOf(r);
    return v === "followers" && ownerOf(r) && ownerOf(r) !== viewer;
  });
  const followed = need.length ? await followedOwners(viewer, need.map((r) => ownerOf(r) as string)) : new Set<string>();
  // Публикации «на проверке» и скрытые модератором видит только автор.
  const heldIds = new Set<string>();
  const allIds = rows.map((r) => (r as any)?.id as string | undefined).filter(Boolean) as string[];
  for (let i = 0; i < allIds.length; i += 200) {
    const { data: held } = await supabaseAdmin
      .from("content_posts")
      .select("id")
      .in("id", allIds.slice(i, i + 200))
      .neq("mod_status", "ok");
    (held ?? []).forEach((h: any) => heldIds.add(h.id));
  }
  return rows.filter((r) => {
    if (heldIds.has((r as any)?.id) && ownerOf(r) !== viewer) return false;
    const v = visOf(r) || "all";
    const o = ownerOf(r);
    if (v === "all") return true;
    if (!o) return false;
    if (o === viewer) return true;
    return v === "followers" && followed.has(o);
  });
}
