import { verifyStoredFile } from "@/lib/fileCheck";
import { hasBadWords } from "@/lib/badWords";
import { checkImageNsfw } from "@/lib/nsfw";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { bunnyDeleteVideo, bunnyGetVideo, bunnyPlayUrl } from "@/lib/bunny";
import { cleanVisibility } from "@/lib/postVisibility";
import { resolvePlace } from "@/lib/places";
import { countryOfUser, settingsForCountry } from "@/lib/countryServer";
import { rateLimit } from "@/lib/rateLimit";
import { logSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";

type In = { kind?: string; url?: string; videoId?: string };

// Публикация: фото и видео (до 10), подпись, кто видит, место.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "post/create", 12, 600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const raw: In[] = Array.isArray(b.media) ? b.media.slice(0, 10) : [];
  if (!raw.length) return bad("no_media");
  const caption = String(b.caption ?? "").slice(0, 500);
  if (hasBadWords(caption)) return bad("bad_words");
  const visibility = cleanVisibility(b.visibility);

  // Приём публикаций выключен в CRM: ничего не публикуем, материал уходит в черновики.
  const gate = await settingsForCountry(["publishing_enabled"], await countryOfUser(uid));
  if (gate.publishing_enabled === "false") {
    const media = raw.map((m) => ({ kind: m.kind === "video" ? "video" : "photo", url: m.url ?? null, videoId: m.videoId ?? null }));
    const rec = {
      user_id: uid,
      caption,
      media,
      visibility,
      place_id: b.placeId ? String(b.placeId) : null,
      place_name: b.placeName ? String(b.placeName).slice(0, 60) : null,
      tags: Array.isArray(b.tags) ? b.tags.map(String).slice(0, 10) : [],
      settings: { comments: b.allowComments !== false, likes: b.allowLikes !== false, reposts: b.allowReposts !== false },
      updated_at: new Date().toISOString(),
    };
    if (b.draftId) {
      const { error } = await supabaseAdmin.from("post_drafts").update(rec).eq("id", String(b.draftId)).eq("user_id", uid);
      if (error) return bad("save_failed", 500);
      return NextResponse.json({ ok: true, queued: true });
    }
    const { count } = await supabaseAdmin.from("post_drafts").select("id", { count: "exact", head: true }).eq("user_id", uid);
    if ((count ?? 0) >= 20) return bad("too_many");
    const { error } = await supabaseAdmin.from("post_drafts").insert(rec);
    if (error) return bad("save_failed", 500);
    return NextResponse.json({ ok: true, queued: true });
  }

  const { data: part } = await supabaseAdmin.from("participants").select("id").eq("user_id", uid).maybeSingle();

  const items: { kind: "photo" | "video"; url: string; videoId?: string; dur?: number }[] = [];
  for (const m of raw) {
    const kind = m.kind === "video" ? "video" : "photo";
    if (kind === "video" && m.videoId) {
      const { data: up } = await supabaseAdmin
        .from("video_uploads")
        .select("video_id, user_id, used")
        .eq("video_id", String(m.videoId))
        .maybeSingle();
      if (!up || up.user_id !== uid) return bad("not_yours", 403);
      if (up.used) return bad("already_used");
      const info = await bunnyGetVideo(String(m.videoId));
      if (!info) return bad("bunny_failed", 502);
      const len = Number(info.length ?? 0);
      if (len > 61) {
        await bunnyDeleteVideo(String(m.videoId));
        await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", String(m.videoId));
        return bad("too_long");
      }
      items.push({ kind, url: bunnyPlayUrl(String(m.videoId)), videoId: String(m.videoId), dur: len > 0 ? Math.round(len) : undefined });
    } else {
      const url = String(m.url ?? "");
      // Только свой файл из нашего хранилища: имя начинается с номера аккаунта.
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
      const prefix = `${base}/storage/v1/object/public/`;
      const rest = base && url.startsWith(prefix) ? url.slice(prefix.length) : "";
      const [bucket, ...nameParts] = rest.split("/");
      const fname = nameParts.join("/");
      const okBucket = bucket === "participant-photos" || bucket === "media-videos";
      if (!okBucket || !fname.startsWith(`${uid}-`)) {
        await logSecurity("bad_upload_url", { url: url.slice(0, 120) }, { req, userId: uid });
        return bad("bad_url");
      }
      if (!(await verifyStoredFile(url, kind === "video" ? "video" : "image"))) {
        await logSecurity("bad_upload_file", { bucket, name: fname.slice(0, 80) }, { req, userId: uid });
        return bad("bad_file");
      }
      items.push({ kind, url });
    }
  }

  // Проверка 18+: режим «сначала проверка» (CRM) или автопроверка фото (если подключена).
  let held = "";
  const modSet = await settingsForCountry(["moderation_mode"], await countryOfUser(uid));
  if (modSet.moderation_mode === "before") held = "перед публикацией (режим CRM)";
  if (!held) {
    for (const i of items.filter((x) => x.kind === "photo").slice(0, 3)) {
      const r = await checkImageNsfw(i.url);
      if (r?.flag) {
        held = r.reason;
        break;
      }
    }
  }

  const placeId = await resolvePlace(uid, b.placeId, b.placeName);
  const cover = items[0];
  const { data: row, error } = await supabaseAdmin
    .from("content_posts")
    .insert({
      participant_id: part?.id ?? null,
      user_id: uid,
      platform: "vetoks",
      media_type: cover.kind,
      video_url: cover.kind === "video" ? cover.url : null,
      photo_url: cover.kind === "photo" ? cover.url : null,
      bunny_video_id: cover.videoId ?? null,
      duration_sec: cover.dur ?? null,
      caption,
      is_verified: true,
      extra_media: items.slice(1).map((i) => ({ kind: i.kind, url: i.url, videoId: i.videoId ?? null })),
      visibility,
      place_id: placeId,
      allow_comments: b.allowComments !== false,
      allow_likes: b.allowLikes !== false,
      allow_reposts: b.allowReposts !== false,
    })
    .select("id")
    .maybeSingle();
  if (error || !row) return bad("insert_failed", 500);

  if (held) {
    // Отдельным запросом: если колонки ещё нет, публикация всё равно создана.
    await supabaseAdmin.from("content_posts").update({ mod_status: "pending", mod_reason: held }).eq("id", row.id);
    await notify(uid, "🛡 Публикация отправлена на проверку модератору. Она появится у всех после проверки.", "/profile");
  }

  for (const i of items) {
    if (i.videoId) await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", i.videoId);
  }
  if (b.draftId) await supabaseAdmin.from("post_drafts").delete().eq("id", String(b.draftId)).eq("user_id", uid);

  return NextResponse.json({ ok: true, postId: row.id, held: !!held, participantId: part?.id ?? null, hasVideo: items.some((i) => i.kind === "video") });
}
