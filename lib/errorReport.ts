// Общий код для отчётов об ошибках (клиент отправляет на /api/client-error).
export function sendClientError(message: string, extra: { stack?: string; where?: string } = {}) {
  try {
    const key = "vt_err_cnt";
    const n = Number(sessionStorage.getItem(key) || 0);
    if (n >= 5) return; // не больше 5 отчётов за сеанс
    sessionStorage.setItem(key, String(n + 1));
  } catch {}
  try {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: String(message).slice(0, 300),
        stack: String(extra.stack ?? "").slice(0, 600),
        where: extra.where || (typeof location !== "undefined" ? location.pathname : ""),
        ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 160) : "",
      }),
    }).catch(() => {});
  } catch {}
}
