import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfRegion, regionIdsOfCountry } from "@/lib/countryServer";

// Новый человек автоматически подписывается на официальную страницу VETOKS своей страны.
// Ошибка здесь никогда не ломает регистрацию.
export async function autoFollowOfficial(userId: string, regionId?: string | null) {
  try {
    let rid = regionId ?? null;
    if (!rid) {
      const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", userId).maybeSingle();
      rid = ((u as any)?.region_id as string | null) ?? null;
    }
    const cid = await countryOfRegion(rid);
    if (!cid) return;
    const ids = await regionIdsOfCountry(cid);
    if (!ids.length) return;
    const { data: off } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("is_official", true)
      .in("region_id", ids)
      .limit(1)
      .maybeSingle();
    const oid = (off as any)?.id as string | undefined;
    if (!oid || oid === userId) return;
    const { data: ex } = await supabaseAdmin
      .from("user_follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("followed_id", oid)
      .maybeSingle();
    if (!ex) await supabaseAdmin.from("user_follows").insert({ follower_id: userId, followed_id: oid });
  } catch {
    /* подписка не обязательна для регистрации */
  }
}
