import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { bunnyDeleteVideo, bunnyGetVideo, bunnyPlayUrl } from "@/lib/bunny";
import { cleanVisibility } from "@/lib/postVisibility";
import { resolvePlace } from "@/lib/places";

export const dynamic = "force-dynamic";

type In = { kind?: string; url?: string; videoId?: string };

// Публикация: фото и видео (до 10), подпись, кто видит, место.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const raw: In[] = Array.isArray(b.media) ? b.media.slice(0, 10) : [];
  if (!raw.length) return bad("no_media");
  const caption = String(b.caption ?? "").slice(0, 500);
  const visibility = cleanVisibility(b.visibility);

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
      if (!url.startsWith("https://") || !url.includes("/storage/v1/object/public/")) return bad("bad_url");
      items.push({ kind, url });
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
    })
    .select("id")
    .maybeSingle();
  if (error || !row) return bad("insert_failed", 500);

  for (const i of items) {
    if (i.videoId) await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", i.videoId);
  }
  if (b.draftId) await supabaseAdmin.from("post_drafts").delete().eq("id", String(b.draftId)).eq("user_id", uid);

  return NextResponse.json({ ok: true, postId: row.id, participantId: part?.id ?? null, hasVideo: items.some((i) => i.kind === "video") });
}
