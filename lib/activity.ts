import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ACT_KEY, parseAct, type ActKind } from "@/lib/activityShared";

// Метрики участницы за весь сезон шоу (по правилам из CRM считаем только нужные).
export async function activityMetrics(participantId: string, kinds: ActKind[]): Promise<Record<ActKind, number>> {
  const out: Record<ActKind, number> = { subscribers: 0, views: 0, gifts: 0, votes: 0, posts: 0, invites: 0 };
  const { data: p } = await supabaseAdmin.from("participants").select("user_id, season_id").eq("id", participantId).maybeSingle();
  if (!p) return out;
  let since = new Date(Date.now() - 180 * 86400000).toISOString();
  if ((p as any).season_id) {
    const { data: se } = await supabaseAdmin.from("seasons").select("created_at").eq("id", (p as any).season_id).maybeSingle();
    if ((se as any)?.created_at) since = (se as any).created_at as string;
  }
  const has = (k: ActKind) => kinds.includes(k);
  if (has("subscribers")) {
    const { count } = await supabaseAdmin.from("participant_follows").select("participant_id", { count: "exact", head: true }).eq("participant_id", participantId);
    out.subscribers = count ?? 0;
  }
  if (has("views") || has("posts")) {
    const { data } = await supabaseAdmin.from("content_posts").select("*").eq("participant_id", participantId).gte("created_at", since).limit(2000);
    const ok = (data ?? []).filter((x: any) => x.mod_status !== "pending" && x.mod_status !== "rejected");
    out.posts = ok.length;
    out.views = ok.reduce((a: number, x: any) => a + Number(x.views ?? 0), 0);
  }
  if (has("gifts")) {
    const { data } = await supabaseAdmin.from("gifts").select("total_price").eq("participant_id", participantId).gte("created_at", since).limit(5000);
    out.gifts = (data ?? []).reduce((a: number, x: any) => a + Number(x.total_price ?? 0), 0);
  }
  if (has("votes")) {
    const { count } = await supabaseAdmin.from("votes").select("id", { count: "exact", head: true }).eq("participant_id", participantId).gte("created_at", since);
    out.votes = count ?? 0;
  }
  if (has("invites")) {
    const { count } = await supabaseAdmin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", (p as any).user_id)
      .eq("status", "qualified")
      .gte("created_at", since);
    out.invites = count ?? 0;
  }
  return out;
}

// Добавка к доле обычной участницы за активность (в процентных пунктах). Амбассадорам не применяется.
export async function activityBonus(participantId: string | null): Promise<number> {
  if (!participantId) return 0;
  try {
    const { data: st } = await supabaseAdmin.from("platform_settings").select("value").eq("key", ACT_KEY).maybeSingle();
    const cfg = parseAct(st?.value);
    if (!cfg.regular || !cfg.rules.length) return 0;
    const { data: p } = await supabaseAdmin.from("participants").select("is_ambassador").eq("id", participantId).maybeSingle();
    if (!p || (p as any).is_ambassador) return 0;
    const m = await activityMetrics(participantId, Array.from(new Set(cfg.rules.map((r) => r.kind))));
    let sum = 0;
    for (const r of cfg.rules) if (m[r.kind] >= r.min) sum += r.bonus;
    return Math.min(cfg.max, sum);
  } catch {
    return 0;
  }
}
