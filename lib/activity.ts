import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ACT_KEY, parseAct, type ActRule } from "@/lib/activityShared";

export async function activityBonus(participantId: string | null): Promise<number> {
  if (!participantId) return 0;
  try {
    const { data: st } = await supabaseAdmin.from("platform_settings").select("value").eq("key", ACT_KEY).maybeSingle();
    const cfg = parseAct(st?.value);
    if (!cfg.regular && !cfg.amb) return 0;
    const { data: p } = await supabaseAdmin.from("participants").select("user_id, is_ambassador").eq("id", participantId).maybeSingle();
    if (!p) return 0;
    if (p.is_ambassador ? !cfg.amb : !cfg.regular) return 0;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    let posts = 0;
    let invites = 0;
    if (cfg.rules.some((r) => r.kind === "posts")) {
      const { data } = await supabaseAdmin.from("content_posts").select("*").eq("participant_id", participantId).gte("created_at", since).limit(500);
      posts = (data ?? []).filter((x: any) => x.mod_status !== "pending" && x.mod_status !== "rejected").length;
    }
    if (cfg.rules.some((r) => r.kind === "invites")) {
      const { count } = await supabaseAdmin
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", p.user_id)
        .eq("status", "qualified")
        .gte("created_at", since);
      invites = count ?? 0;
    }
    let sum = 0;
    for (const r of cfg.rules) if ((r.kind === "posts" ? posts : invites) >= r.min) sum += r.bonus;
    return Math.min(cfg.max, sum);
  } catch {
    return 0;
  }
}
