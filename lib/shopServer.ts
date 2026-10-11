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

export async function notify(userId: string, message: string, link?: string) {
  await supabaseAdmin
    .from("notifications")
    .insert({ user_id: userId, message, link: link ?? null });
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
  | { ok: false; error: string; balance?: number }
> {
  const { data, error } = await supabaseAdmin.rpc("vt_pay", {
    p_user: userId,
    p_amount: amount,
    p_type: type,
    p_participant: participantId,
    p_share: share,
    p_meta: meta,
  });
  if (error || !data) return { ok: false, error: "pay_failed" };
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

// Понедельник текущей недели по киевскому времени (YYYY-MM-DD).
export function kyivWeekStart(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const d = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day")));
  d.setUTCDate(d.getUTCDate() - (dow < 0 ? 0 : dow));
  return d.toISOString().slice(0, 10);
}
