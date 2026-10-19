import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Журнал подозрительных действий + оповещение владельцу в Telegram.
// Если таблицы security_events ещё нет — молча ничего не пишем, сайт работает как обычно.
export const SECURITY_TITLES: Record<string, string> = {
  login_locked: "Вход заблокирован после неверных паролей",
  reset_locked: "Сброс пароля заблокирован после неверных кодов",
  bot_code_locked: "Бот: перебор кода",
  rate_limited: "Слишком частые запросы",
  admin_denied: "Попытка зайти в CRM без прав",
  webhook_bad_secret: "Поддельный запрос к Telegram-боту",
  bad_upload_url: "Подозрительная ссылка на файл",
  client_error: "Ошибка в приложении у человека",
  bad_upload_file: "Загрузили файл, который не фото и не видео",
  server_error: "Ошибка на сервере",
};

async function once(key: string, windowSec: number): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.rpc("vt_rate_hit", { p_key: key.slice(0, 200), p_window: windowSec, p_max: 1 });
    return !data || !!(data as any).ok;
  } catch {
    return true;
  }
}

function ipOf(req?: Request): string | null {
  if (!req) return null;
  const h = req.headers;
  const ip = h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "";
  return ip.trim().slice(0, 64) || null;
}

async function alertOwners(text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    const { data } = await supabaseAdmin
      .from("users")
      .select("telegram_id")
      .eq("role", "super_admin")
      .not("telegram_id", "is", null)
      .limit(3);
    for (const u of data ?? []) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: (u as any).telegram_id, text }),
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/** Записать событие. dedupeSec — не чаще раза за это время для такого же вида+ключа. alert — сообщить владельцу. */
export async function logSecurity(
  kind: string,
  detail: Record<string, unknown> = {},
  opts: { req?: Request; userId?: string | null; alert?: boolean; dedupeKey?: string; dedupeSec?: number } = {}
) {
  try {
    const ip = ipOf(opts.req);
    if (opts.dedupeSec && !(await once(`sec:${kind}:${opts.dedupeKey ?? ip ?? "-"}`, opts.dedupeSec))) return;
    await supabaseAdmin.from("security_events").insert({ kind, ip, user_id: opts.userId ?? null, detail });
    if (opts.alert && (await once(`secalert:${kind}`, 600))) {
      const d = Object.entries(detail)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
        .join("\n");
      await alertOwners(`🚨 VETOKS: ${SECURITY_TITLES[kind] ?? kind}${ip ? `\nIP: ${ip}` : ""}${d ? "\n" + d : ""}`);
    }
  } catch {
    /* защита не должна ронять сайт */
  }
}

/** Запомнить, с какого адреса человек регистрировался, входил, голосовал: так в CRM видно «много аккаунтов с одного адреса». */
export async function recordActivity(req: Request, userId: string, kind: string, participantId?: string | null) {
  try {
    const ip = ipOf(req);
    if (!ip) return;
    if (!(await once(`act:${kind}:${userId}:${ip}:${participantId ?? ""}`, 21600))) return;
    await supabaseAdmin.from("activity_ips").insert({ user_id: userId, ip, kind, participant_id: participantId ?? null });
  } catch {
    /* не должно мешать основному действию */
  }
}

/** Завершить все входы аккаунта на всех устройствах (после смены пароля, блокировки). */
export async function killSessions(userId: string) {
  try {
    await supabaseAdmin.rpc("vt_kill_sessions", { p_user: userId });
  } catch {
    /* если SQL ещё не выполнен — молча пропускаем */
  }
}
