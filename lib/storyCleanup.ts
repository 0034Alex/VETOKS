import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bunnyDeleteVideo } from "@/lib/bunny";
import { parseStorageUrl } from "@/lib/fileCheck";

// Уборка историй: через час после истечения 24 часов удаляем и файлы, и записи.
export async function cleanupStories(): Promise<{ removed: number }> {
  const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin.from("stories").select("id, url, video_id").lt("expires_at", cutoff).limit(500);
  const rows = (data as { id: string; url: string; video_id: string | null }[]) ?? [];
  const byBucket: Record<string, string[]> = {};
  for (const r of rows) {
    if (r.video_id) {
      await bunnyDeleteVideo(r.video_id);
    } else {
      const p = parseStorageUrl(r.url);
      if (p) (byBucket[p.bucket] = byBucket[p.bucket] ?? []).push(p.name);
    }
  }
  for (const [bucket, names] of Object.entries(byBucket)) {
    for (let i = 0; i < names.length; i += 100) {
      await supabaseAdmin.storage.from(bucket).remove(names.slice(i, i + 100));
    }
  }
  if (rows.length) {
    await supabaseAdmin.from("stories").delete().in("id", rows.map((r) => r.id));
  }
  return { removed: rows.length };
}
