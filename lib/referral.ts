import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";

export const REF_KEYS = ["referral_enabled", "referral_reward_referrer", "referral_reward_invited", "referral_daily_limit", "referral_max_rewarded"];

// Награды и лимиты у каждой страны свои (ключ "<ключ>:<id страны>"), иначе общие.
export async function getRefSettings(countryId?: string | null) {
  const all = [...REF_KEYS];
  if (countryId) REF_KEYS.forEach((k) => all.push(`${k}:${countryId}`));
  const { data } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", all);
  const raw: Record<string, string> = {};
  (data ?? []).forEach((r: any) => (raw[r.key] = r.value ?? ""));
  const m: Record<string, string> = {};
  REF_KEYS.forEach((k) => {
    const own = countryId ? raw[`${k}:${countryId}`] : undefined;
    if (own !== undefined) m[k] = own;
    else if (raw[k] !== undefined) m[k] = raw[k];
  });
  const num = (k: string, d: number) => {
    const n = Number(m[k]);
    return m[k] !== undefined && m[k] !== "" && isFinite(n) ? n : d;
  };
  return {
    enabled: m.referral_enabled !== "false",
    rewardReferrer: num("referral_reward_referrer", 0),
    rewardInvited: num("referral_reward_invited", 0),
    dailyLimit: num("referral_daily_limit", 20),
    maxRewarded: num("referral_max_rewarded", 50),
  };
}

// Друг подтвердил номер — засчитываем приглашение и начисляем награды (один раз).
export async function qualifyReferral(userId: string) {
  try {
    const s = await getRefSettings(await countryOfUser(userId));
    if (!s.enabled) return;
    const { data } = await supabaseAdmin.rpc("vt_qualify_referral", {
      p_referred: userId,
      p_ref: s.rewardReferrer,
      p_inv: s.rewardInvited,
      p_max: s.maxRewarded,
    });
    const r = data as any;
    if (!r?.ok) return;
    const paid = Number(r.reward_referrer);
    await notify(
      r.referrer_id,
      paid > 0
        ? `🎉 Ваш друг подтвердил номер — вам начислено ${Math.round(paid)} ₴`
        : "🎉 Ваш друг подтвердил номер — приглашение засчитано",
      "/invites"
    );
    if (Number(r.reward_invited) > 0) {
      await notify(userId, `🎁 Бонус за приглашение: ${Math.round(Number(r.reward_invited))} ₴`, "/history");
    }
  } catch {
    /* награда не должна ломать подтверждение номера */
  }
}
