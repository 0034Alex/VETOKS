import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Повышение доли участницы за активность (за последние 30 дней). Правила — в CRM «Цены и выплаты».
export const ACT_KEY = "activity_bonus";
export type ActRule = { kind: "posts" | "invites"; min: number; bonus: number };
export type ActRules = { regular: boolean; amb: boolean; max: number; rules: ActRule[] };

export const ACT_DEFAULT: ActRules = {
  regular: false,
  amb: false,
  max: 10,
  rules: [
    { kind: "posts", min: 10, bonus: 2 },
    { kind: "invites", min: 50, bonus: 3 },
  ],
};

export function parseAct(raw?: string | null): ActRules {
  try {
    const o = JSON.parse(String(raw || ""));
    const rules = Array.isArray(o.rules)
      ? o.rules
          .map((r: any) => ({ kind: r.kind === "invites" ? "invites" : "posts", min: Math.max(0, Math.floor(Number(r.min) || 0)), bonus: Math.max(0, Math.min(100, Number(r.bonus) || 0)) }))
          .filter((r: ActRule) => r.min > 0 && r.bonus > 0)
      : ACT_DEFAULT.rules;
    return { regular: !!o.regular, amb: !!o.amb, max: Math.max(0, Math.min(100, Number(o.max) || 0)), rules };
  } catch {
    return ACT_DEFAULT;
  }
}

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
