import { supabase } from "@/lib/supabaseClient";

export type TitleBadge = { icon: string; label: string; hint: string };

const ICONS: Record<string, string> = {
  total_votes: "🏆",
  second_votes: "🥈",
  day_votes: "⚡",
  gifts: "🎁",
  followers: "👥",
  tasks: "✅",
  messages: "💬",
  boosts: "🚀",
  rookie_votes: "🌱",
};

// Титулы участницы за последний ночной пересчёт.
export async function loadTitleBadges(participantId: string): Promise<TitleBadge[]> {
  try {
    const { data: last } = await supabase
      .from("title_rankings_v2")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);
    if (!last?.length) return [];
    const { data: rows } = await supabase
      .from("title_rankings_v2")
      .select("title_key, scope")
      .eq("participant_id", participantId)
      .eq("snapshot_date", last[0].snapshot_date);
    if (!rows?.length) return [];
    const keys = Array.from(new Set(rows.map((r: any) => r.title_key as string)));
    const { data: settings } = await supabase
      .from("title_settings")
      .select("key, label, metric, enabled, sort_order")
      .in("key", keys)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return (settings ?? []).map((s: any) => {
      const country = rows.some((r: any) => r.title_key === s.key && r.scope === "country");
      return {
        icon: ICONS[s.metric] ?? "⭐",
        label: s.label as string,
        hint: country ? "по всей стране" : "в своём регионе",
      };
    });
  } catch {
    return [];
  }
}
