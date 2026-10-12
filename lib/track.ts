// Считаем показы и клики по рекламе (баннеры и логотипы партнёров).
// Показ засчитывается один раз за визит (пока открыта вкладка).
export function trackAd(kind: "view" | "click", type: "banner" | "logo", ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  let list = ids;
  if (kind === "view") {
    try {
      const seen: string[] = JSON.parse(sessionStorage.getItem("ad_seen") || "[]");
      list = ids.filter((id) => !seen.includes(`${type}:${id}`));
      if (list.length === 0) return;
      sessionStorage.setItem("ad_seen", JSON.stringify(seen.concat(list.map((id) => `${type}:${id}`)).slice(-300)));
    } catch {
      /* без sessionStorage просто считаем */
    }
  }
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, type, ids: list }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
