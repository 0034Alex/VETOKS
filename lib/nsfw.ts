// Автопроверка фото на откровенный контент (18+) через внешний сервис Sightengine.
// Пока ключи SIGHTENGINE_USER и SIGHTENGINE_SECRET не заданы в Vercel — проверка выключена,
// остаётся ручная модерация. Любая ошибка сервиса не мешает публикации (пропускаем).

export type NsfwResult = { flag: boolean; reason: string } | null;

export function nsfwConfigured(): boolean {
  return !!(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
}

export async function checkImageNsfw(url: string): Promise<NsfwResult> {
  const user = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret || !url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const q = new URLSearchParams({ url, models: "nudity-2.1", api_user: user, api_secret: secret });
    const res = await fetch(`https://api.sightengine.com/1.0/check.json?${q.toString()}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j?.status !== "success" || !j.nudity) return null;
    const n = j.nudity;
    const explicit = Math.max(Number(n.sexual_activity) || 0, Number(n.sexual_display) || 0, Number(n.erotica) || 0);
    const suggestive = Number(n.very_suggestive) || 0;
    if (explicit >= 0.5) return { flag: true, reason: `auto: откровенное (${Math.round(explicit * 100)}%)` };
    if (suggestive >= 0.8) return { flag: true, reason: `auto: слишком откровенное (${Math.round(suggestive * 100)}%)` };
    return { flag: false, reason: "" };
  } catch {
    return null;
  }
}
