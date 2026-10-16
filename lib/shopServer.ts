import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";

export const bad = (error: string, status = 400, extra: object = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

// Кто делает запрос. Заблокированным покупки и голоса недоступны.
export async function requireUser(req: Request): Promise<string | NextResponse> {
  const id = await userIdFromBearer(req);
  if (!id) return bad("auth", 401);
  const { data } = await supabaseAdmin
    .from("users")
    .select("is_banned")
    .eq("id", id)
    .maybeSingle();
  if (!data) return bad("auth", 401);
  if (data.is_banned) return bad("banned", 403);
  return id;
}

// type: gifts | tasks | support | other — по нему смотрим настройки «Уведомления в Telegram».
export async function notify(userId: string, message: string, link?: string, type: string = "other") {
  await supabaseAdmin
    .from("notifications")
    .insert({ user_id: userId, message, link: link ?? null });

  // Дублируем важное сообщением от бота (если Telegram привязан и не выключено в настройках).
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("telegram_id, notify_tg")
      .eq("id", userId)
      .maybeSingle();
    if (!u?.telegram_id) return;
    const prefs = (u.notify_tg ?? {}) as Record<string, boolean>;
    if (prefs[type] === false) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: u.telegram_id, text: message }),
    });
  } catch {
    /* уведомление в приложении уже сохранено */
  }
}

// Платёж: списать у покупателя, начислить долю участнице (одной операцией в базе).
export async function pay(
  userId: string,
  amount: number,
  type: string,
  participantId: string | null,
  share: number,
  meta: object = {}
): Promise<
  | { ok: true; tx_id: string; earning: number; balance: number }
  | { ok: false; error: string; balance?: number; detail?: string }
> {
  // Амбассадорам к доле добавляется их бонус (только если доля вообще положена).
  let finalShare = share;
  if (participantId && share > 0) {
    const { ambassadorBonus } = await import("@/lib/ambassador");
    finalShare = Math.min(100, share + (await ambassadorBonus(participantId)));
  }
  const { data, error } = await supabaseAdmin.rpc("vt_pay", {
    p_user: userId,
    p_amount: amount,
    p_type: type,
    p_participant: participantId,
    p_share: finalShare,
    p_meta: meta,
  });
  if (error || !data) return { ok: false, error: "pay_failed", detail: error?.message };
  return data as any;
}

export async function refund(
  userId: string,
  amount: number,
  participantId: string | null,
  earning: number
) {
  await supabaseAdmin.rpc("vt_refund", {
    p_user: userId,
    p_amount: amount,
    p_participant: participantId,
    p_earning: earning,
  });
}

export async function participantOwner(participantId: string) {
  const { data } = await supabaseAdmin
    .from("participants")
    .select("user_id, display_name")
    .eq("id", participantId)
    .maybeSingle();
  return data as { user_id: string; display_name: string } | null;
}

// Участница чужой страны недоступна для голосов, подарков, донатов, буста и карточек.
export async function blockOtherCountry(uid: string, participantId: string) {
  const o = await participantOwner(participantId);
  if (!o) return bad("no_participant", 404);
  const { sameCountry } = await import("@/lib/countryServer");
  if (!(await sameCountry(uid, o.user_id))) return bad("other_country", 403);
  return null;
}

export { kyivWeekStart } from "@/lib/kyiv";

// Живая Фан-Зона: запись о дорогой покупке в общую ленту (если включено в CRM и сумма не меньше порога).
export async function fanEvent(
  userId: string,
  participantId: string,
  participantName: string,
  kind: "gift" | "boost" | "card" | "donate",
  label: string,
  amount: number
) {
  try {
    const { data: st } = await supabaseAdmin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["fanzone_enabled", "fanzone_min_amount"]);
    const m: Record<string, string> = {};
    (st ?? []).forEach((r: any) => (m[r.key] = r.value ?? ""));
    if (m.fanzone_enabled === "false") return;
    const min = Number(m.fanzone_min_amount);
    if (amount < (Number.isFinite(min) && m.fanzone_min_amount !== "" ? min : 50)) return;
    const { data: u } = await supabaseAdmin.from("users").select("first_name, privacy").eq("id", userId).maybeSingle();
    const hideName = (u?.privacy as any)?.feed === false;
    const { data: pr } = await supabaseAdmin.from("participants").select("region_id").eq("id", participantId).maybeSingle();
    await supabaseAdmin.from("fan_feed").insert({
      region_id: pr?.region_id ?? null,
      sender_name: hideName ? "Аноним" : (u?.first_name as string) || "Гость",
      participant_id: participantId,
      participant_name: participantName,
      kind,
      label,
      amount,
    });
  } catch {
    /* лента не должна ломать покупку */
  }
}
