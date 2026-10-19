import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKETS = ["participant-photos", "media-videos", "card-images", "promo-banners", "promo-videos", "stage-banners", "partner-logos", "partner-creatives", "magazine-ads", "media-materials"];
// Таблицы, где могут лежать ссылки на файлы.
const TABLES = [
  "users", "participants", "applications", "content_posts", "content_suggestions", "post_drafts", "collectible_cards",
  "promo_banners", "magazine_ads", "magazine_answers", "media_materials", "partner_logos", "partner_creative_uploads",
  "season_stages", "sponsors", "ad_slot_requests", "ad_slots", "video_uploads", "participant_messages", "gift_catalog",
  "popup_settings", "platform_settings", "custom_tasks", "support_requests", "countries", "social_links", "dm_messages",
];
const MIN_AGE_DAYS = 14;
const ROW_CAP = 60000;

type F = { bucket: string; name: string; size: number; created: string };

async function listAll(bucket: string): Promise<F[]> {
  const out: F[] = [];
  async function walk(prefix: string, depth: number) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000, offset });
      if (error || !data || data.length === 0) break;
      for (const it of data as any[]) {
        const path = prefix ? `${prefix}/${it.name}` : it.name;
        if (!it.id) {
          if (depth < 3) await walk(path, depth + 1); // папка
        } else {
          out.push({ bucket, name: path, size: Number(it.metadata?.size ?? 0), created: String(it.created_at ?? it.updated_at ?? "") });
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  await walk("", 0);
  return out;
}

// Собираем всё, что есть в базе, одним большим текстом. Если какая-то таблица слишком большая — чистку не делаем (безопасность).
async function referencesBlob(): Promise<{ blob: string } | { error: string }> {
  const parts: string[] = [];
  for (const t of TABLES) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin.from(t).select("*").range(from, from + 999);
      if (error) break; // такой таблицы нет — пропускаем
      if (!data || data.length === 0) break;
      parts.push(JSON.stringify(data));
      from += 1000;
      if (from >= ROW_CAP) return { error: `Таблица ${t} слишком большая для безопасной проверки.` };
      if (data.length < 1000) break;
    }
  }
  return { blob: parts.join("\n") };
}

async function findOrphans(): Promise<{ orphans: F[]; total: number } | { error: string }> {
  const refs = await referencesBlob();
  if ("error" in refs) return refs;
  const cutoff = Date.now() - MIN_AGE_DAYS * 86400000;
  const orphans: F[] = [];
  let total = 0;
  for (const b of BUCKETS) {
    const files = await listAll(b);
    total += files.length;
    for (const f of files) {
      const created = new Date(f.created).getTime();
      if (!created || created > cutoff) continue; // свежие не трогаем
      if (!refs.blob.includes(f.name) && !refs.blob.includes(encodeURIComponent(f.name))) orphans.push(f);
    }
  }
  return { orphans, total };
}

// CRM → Безопасность: чистка «осиротевших» файлов. Только главный админ.
export async function POST(req: Request) {
  const auth = await requireStaff(req, ["super_admin"]);
  if (auth instanceof NextResponse) return auth;
  const uid = auth;
  const b = await req.json().catch(() => ({}));

  const r = await findOrphans();
  if ("error" in r) return NextResponse.json({ ok: false, error: "too_big", message: r.error }, { status: 400 });
  const bytes = r.orphans.reduce((s, f) => s + f.size, 0);

  if (b.action === "scan") {
    const byBucket: Record<string, number> = {};
    for (const f of r.orphans) byBucket[f.bucket] = (byBucket[f.bucket] ?? 0) + 1;
    return NextResponse.json({ ok: true, total: r.total, orphans: r.orphans.length, bytes, byBucket, sample: r.orphans.slice(0, 15).map((f) => `${f.bucket}/${f.name}`) });
  }

  if (b.action === "delete") {
    if (b.confirm !== "УДАЛИТЬ") return NextResponse.json({ ok: false, error: "no_confirm" }, { status: 400 });
    let deleted = 0;
    const groups: Record<string, string[]> = {};
    for (const f of r.orphans) (groups[f.bucket] ??= []).push(f.name);
    for (const [bucket, names] of Object.entries(groups)) {
      for (let i = 0; i < names.length; i += 100) {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(names.slice(i, i + 100));
        if (!error) deleted += Math.min(100, names.length - i);
      }
    }
    await logAction(uid, "storage_cleanup", null, { deleted, bytes });
    return NextResponse.json({ ok: true, deleted, bytes });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
