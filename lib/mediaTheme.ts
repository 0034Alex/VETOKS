import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfRegion } from "@/lib/countryServer";

// Тема для нового ролика: действующая сейчас; если паузы между темами — ближайшая следующая.
export async function setPostTheme(postId: string, participantId: string | null | undefined) {
  try {
    if (!participantId) return;
    const { data: p } = await supabaseAdmin.from("participants").select("region_id").eq("id", participantId).maybeSingle();
    const cid = await countryOfRegion((p?.region_id as string) ?? null);
    if (!cid) return;
    const { data } = await supabaseAdmin
      .from("media_themes")
      .select("id, starts_at, ends_at")
      .or(`country_id.eq.${cid},country_id.is.null`)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) await supabaseAdmin.from("content_posts").update({ theme_id: data.id }).eq("id", postId);
  } catch {
    /* темы ещё не настроены — публикация всё равно создана */
  }
}
