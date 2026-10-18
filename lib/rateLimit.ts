import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logSecurity } from "@/lib/security";

// Защита от перебора и наплыва запросов. Если SQL ещё не выполнен или база не ответила —
// не блокируем людей (fail-open), чтобы сайт не лёг из-за защиты.
export function clientIp(req: Request): string {
  const h = req.headers;
  const ip = h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "unknown";
  return ip.trim().slice(0, 64) || "unknown";
}

export function waitText(sec: number): string {
  if (sec >= 3600) return `${Math.ceil(sec / 3600)} ч`;
  if (sec >= 60) return `${Math.ceil(sec / 60)} мин`;
  return `${sec} сек`;
}

/** Не больше max запросов за windowSec секунд на ключ. */
export async function rateHit(key: string, windowSec: number, max: number): Promise<{ ok: boolean; retry: number }> {
  try {
    const { data, error } = await supabaseAdmin.rpc("vt_rate_hit", { p_key: key.slice(0, 200), p_window: windowSec, p_max: max });
    if (error || !data) return { ok: true, retry: 0 };
    return { ok: !!(data as any).ok, retry: Number((data as any).retry ?? 0) };
  } catch {
    return { ok: true, retry: 0 };
  }
}

/** Лимит на IP (и по желанию на ещё один ключ, например номер). Возвращает ответ 429 или null. */
export async function rateLimit(req: Request, name: string, max: number, windowSec: number, extraKey?: string): Promise<NextResponse | null> {
  const keys = [`${name}:ip:${clientIp(req)}`];
  if (extraKey) keys.push(`${name}:k:${extraKey}`);
  for (const k of keys) {
    const r = await rateHit(k, windowSec, max);
    if (!r.ok) {
      await logSecurity("rate_limited", { route: name }, { req, dedupeKey: `${name}:${clientIp(req)}`, dedupeSec: 600 });
      return NextResponse.json(
        { ok: false, status: "error", error: "rate_limited", message: `Слишком много запросов. Повторите через ${waitText(r.retry)}.`, retry: r.retry },
        { status: 429, headers: { "Retry-After": String(r.retry) } }
      );
    }
  }
  return null;
}

// ---------- блокировка после неверных попыток (3 → 15 мин → 1 час → сутки) ----------
export async function lockCheck(key: string): Promise<{ locked: boolean; retry: number }> {
  try {
    const { data } = await supabaseAdmin.rpc("vt_lock_check", { p_key: key.slice(0, 200) });
    return { locked: !!(data as any)?.locked, retry: Number((data as any)?.retry ?? 0) };
  } catch {
    return { locked: false, retry: 0 };
  }
}
export async function lockFail(key: string, max: number): Promise<{ locked: boolean; retry: number }> {
  try {
    const { data } = await supabaseAdmin.rpc("vt_lock_fail", { p_key: key.slice(0, 200), p_max: max });
    return { locked: !!(data as any)?.locked, retry: Number((data as any)?.retry ?? 0) };
  } catch {
    return { locked: false, retry: 0 };
  }
}
export async function lockClear(key: string) {
  try {
    await supabaseAdmin.rpc("vt_lock_clear", { p_key: key.slice(0, 200) });
  } catch {
    /* ignore */
  }
}

export function lockedResponse(retry: number) {
  return NextResponse.json(
    {
      ok: false,
      status: "error",
      error: "locked",
      message: `Слишком много неверных попыток. Вход временно закрыт, повторите через ${waitText(retry)}.`,
      retry,
    },
    { status: 429, headers: { "Retry-After": String(retry) } }
  );
}
