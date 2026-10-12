import { createHash } from "crypto";

// Настройки Bunny берём только из переменных Vercel. Если их нет — null,
// и приложение работает по-старому (видео в Supabase).
export function bunnyCfg() {
  const lib = process.env.BUNNY_LIBRARY_ID;
  const key = process.env.BUNNY_API_KEY;
  const cdn = process.env.BUNNY_CDN_HOSTNAME;
  if (!lib || !key || !cdn) return null;
  return { lib, key, cdn: cdn.replace(/^https?:\/\//, "").replace(/\/+$/, "") };
}

export async function bunnyCreateVideo(title: string): Promise<string | null> {
  const c = bunnyCfg();
  if (!c) return null;
  const res = await fetch(`https://video.bunnycdn.com/library/${c.lib}/videos`, {
    method: "POST",
    headers: { AccessKey: c.key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.guid ?? null;
}

export async function bunnyGetVideo(guid: string): Promise<any | null> {
  const c = bunnyCfg();
  if (!c) return null;
  const res = await fetch(`https://video.bunnycdn.com/library/${c.lib}/videos/${guid}`, {
    headers: { AccessKey: c.key, accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function bunnyDeleteVideo(guid: string): Promise<void> {
  const c = bunnyCfg();
  if (!c) return;
  await fetch(`https://video.bunnycdn.com/library/${c.lib}/videos/${guid}`, {
    method: "DELETE",
    headers: { AccessKey: c.key },
  }).catch(() => {});
}

export function bunnySignature(guid: string, expire: number): string {
  const c = bunnyCfg()!;
  return createHash("sha256").update(`${c.lib}${c.key}${expire}${guid}`).digest("hex");
}

export function bunnyPlayUrl(guid: string): string {
  const c = bunnyCfg()!;
  return `https://${c.cdn}/${guid}/play_720p.mp4`;
}
