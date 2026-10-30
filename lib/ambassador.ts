import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Амбассадор шоу: участница с повышенным процентом выплат.
// Бонус — это добавка в процентных пунктах к доле, которая и так положена участнице.
export const AMB_DEFAULT_KEY = "ambassador_bonus_default";

export async function ambassadorDefault(): Promise<number> {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", AMB_DEFAULT_KEY).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? Math.min(100, n) : 0;
}

export async function ambassadorBonus(participantId: string | null): Promise<number> {
  if (!participantId) return 0;
  const { data } = await supabaseAdmin
    .from("participants")
    .select("is_ambassador, ambassador_bonus")
    .eq("id", participantId)
    .maybeSingle();
  if (!data?.is_ambassador) return 0;
  const own = data.ambassador_bonus;
  if (own !== null && own !== undefined && Number.isFinite(Number(own))) return Math.max(0, Math.min(100, Number(own)));
  return ambassadorDefault();
}

// Фиксированный процент выплат амбассадору шоу (вместо обычной доли). 0 — не задан.
export const AMB_SHARE_KEY = "ambassador_share";

export async function ambassadorShareValue(): Promise<number> {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", AMB_SHARE_KEY).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? Math.min(100, n) : 0;
}

// null — участница не амбассадор или процент не задан (тогда работает обычная доля).
export async function ambassadorShare(participantId: string | null): Promise<number | null> {
  if (!participantId) return null;
  const { data } = await supabaseAdmin.from("participants").select("is_ambassador").eq("id", participantId).maybeSingle();
  if (!(data as any)?.is_ambassador) return null;
  const v = await ambassadorShareValue();
  return v > 0 ? v : null;
}
