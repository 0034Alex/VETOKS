import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { regionIdsOfCountry } from "@/lib/countryServer";

// Шоу закончилось: победительницы определяются сами, вручную ничего давать не надо.
// 1 место → корона сезона. Топ-10 страны → «Зал славы» (награды «Гранд-финал: N место»).
// Лучшая в каждом регионе → «победительница региона». Если корона уже выдана вручную, её не трогаем.
export async function finalizeWinners(countryId: string, showKey: string): Promise<{ top: number; crowned: boolean }> {
  const { data: sh } = await supabaseAdmin.from("shows").select("contest").eq("key", showKey).maybeSingle();
  const contest = String((sh as any)?.contest ?? showKey);
  const regionIds = await regionIdsOfCountry(countryId);
  if (!regionIds.length) return { top: 0, crowned: false };

  const parts: { id: string; region_id: string | null; crown: string | null }[] = [];
  for (let i = 0; i < regionIds.length; i += 100) {
    const { data } = await supabaseAdmin
      .from("participants")
      .select("id, region_id, crown")
      .eq("contest", contest)
      .eq("is_eliminated", false)
      .in("region_id", regionIds.slice(i, i + 100))
      .limit(5000);
    parts.push(...((data as any[]) ?? []));
  }
  if (!parts.length) return { top: 0, crowned: false };

  const votes = new Map<string, number>();
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabaseAdmin.rpc("vt_vote_totals").range(from, from + 999);
    if (error || !data) break;
    (data as any[]).forEach((r) => votes.set(r.participant_id, Number(r.cnt)));
    if ((data as any[]).length < 1000) break;
  }
  const sorted = [...parts].sort((a, b) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0));
  const top = sorted.slice(0, 10);

  // Награды: перезаписываем прошлые автоматические для этой страны, чтобы не было дублей.
  const ids = parts.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    await supabaseAdmin.from("show_awards").delete().eq("show_key", showKey).like("nomination", "Гранд-финал:%").in("participant_id", ids.slice(i, i + 200));
  }
  for (let i = 0; i < top.length; i++) {
    await supabaseAdmin.from("show_awards").insert({ show_key: showKey, season: "Сезон 1", nomination: `Гранд-финал: ${i + 1} место`, participant_id: top[i].id });
  }

  // Короны только если вручную их никому не выдавали.
  const already = parts.some((p) => p.crown);
  if (!already) {
    if (sorted[0]) await supabaseAdmin.from("participants").update({ crown: "season" }).eq("id", sorted[0].id);
    const bestByRegion = new Map<string, string>();
    for (const p of sorted) if (p.region_id && !bestByRegion.has(p.region_id) && p.id !== sorted[0]?.id) bestByRegion.set(p.region_id, p.id);
    const rids = Array.from(bestByRegion.values());
    for (let i = 0; i < rids.length; i += 200) await supabaseAdmin.from("participants").update({ crown: "region" }).in("id", rids.slice(i, i + 200));
  }
  return { top: top.length, crowned: !already };
}
