import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/shopServer";
import { countryOfUser, sameCountry, currencyOfUser } from "@/lib/countryServer";
import { familyRootId } from "@/lib/familyServer";

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
    const sym = await currencyOfUser(r.referrer_id);
    const symInv = await currencyOfUser(userId);
    await notify(
      r.referrer_id,
      paid > 0
        ? `🎉 Ваш друг подтвердил номер — вам начислено ${Math.round(paid)} ${sym}`
        : "🎉 Ваш друг подтвердил номер — приглашение засчитано",
      "/invites"
    );
    if (Number(r.reward_invited) > 0) {
      await notify(userId, `🎁 Бонус за приглашение: ${Math.round(Number(r.reward_invited))} ${symInv}`, "/history");
    }
  } catch {
    /* награда не должна ломать подтверждение номера */
  }
}

// Человек пришёл по ссылке/коду друга (код или ник пригласившего) — запоминаем, кто пригласил.
// Общая точка для ссылки, Telegram-бота и ручного ввода кода.
export async function claimReferral(
  uid: string,
  rawCode: string
): Promise<{ ok: boolean; error?: string; referrerName?: string | null }> {
  let code = String(rawCode ?? "").trim().slice(0, 40);
  if (!code) return { ok: false, error: "no_code" };
  // Вместо кода можно прислать ник пригласившего (с @ или без).
  const asNick = code.replace(/^@/, "").toLowerCase();
  if (/^[a-z][a-z0-9_]{2,19}$/.test(asNick)) {
    const { data: byNick } = await supabaseAdmin.from("users").select("referral_code").eq("nick", asNick).maybeSingle();
    if (byNick?.referral_code) code = String(byNick.referral_code);
  }
  const { data: refRows } = await supabaseAdmin
    .from("users")
    .select("id, first_name")
    .in("referral_code", Array.from(new Set([code, code.toUpperCase(), code.toLowerCase()])))
    .limit(1);
  const refUser = (refRows ?? [])[0] as { id: string; first_name: string | null } | undefined;
  if (!refUser?.id) return { ok: false, error: "bad_code" };
  const refId = refUser.id as string;
  if (refId === uid) return { ok: false, error: "self" };
  // Пригласивший должен быть из той же страны: страны между собой не пересекаются.
  if (!(await sameCountry(uid, refId))) return { ok: false, error: "other_country" };
  // Свои дополнительные аккаунты (один Telegram — до 3 аккаунтов) не считаются приглашёнными.
  const [a, b] = await Promise.all([familyRootId(uid), familyRootId(refId)]);
  if (a && b && a === b) return { ok: false, error: "self" };
  const s = await getRefSettings(await countryOfUser(uid));
  if (!s.enabled) return { ok: false, error: "disabled" };
  const { data } = await supabaseAdmin.rpc("vt_claim_referral", { p_user: uid, p_code: code, p_daily: s.dailyLimit });
  const r = data as any;
  if (!r?.ok) return { ok: false, error: r?.error ?? "error" };

  const { data: me } = await supabaseAdmin.from("users").select("first_name, phone_verified").eq("id", uid).maybeSingle();
  await notify(
    refId,
    `👋 По вашей ссылке пришёл${me?.first_name ? ` ${me.first_name}` : " новый человек"}. Когда он подтвердит номер в Telegram, приглашение засчитается.`,
    "/invites"
  ).catch(() => {});
  // Номер уже подтверждён до того, как мы запомнили приглашение — засчитываем сразу.
  if (me?.phone_verified) await qualifyReferral(uid);
  return { ok: true, referrerName: (refUser.first_name as string | null) ?? null };
}
