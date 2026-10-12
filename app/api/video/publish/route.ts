import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { bunnyDeleteVideo, bunnyGetVideo, bunnyPlayUrl } from "@/lib/bunny";

export const dynamic = "force-dynamic";

// Шаг 2: файл загружен — публикуем ролик в ленту.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const videoId = String(body.videoId ?? "");
  const caption = String(body.caption ?? "").slice(0, 500);
  if (!videoId) return bad("no_video");

  const { data: up } = await supabaseAdmin
    .from("video_uploads")
    .select("video_id, user_id, participant_id, used")
    .eq("video_id", videoId)
    .maybeSingle();
  if (!up || up.user_id !== uid) return bad("not_yours", 403);
  if (up.used) return bad("already_used");

  const info = await bunnyGetVideo(videoId);
  if (!info) return bad("bunny_failed", 502);

  const length = Number(info.length ?? 0);
  if (length > 61) {
    await bunnyDeleteVideo(videoId);
    await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", videoId);
    return bad("too_long");
  }

  const { error } = await supabaseAdmin.from("content_posts").insert({
    participant_id: up.participant_id,
    platform: "vetoks",
    media_type: "video",
    video_url: bunnyPlayUrl(videoId),
    bunny_video_id: videoId,
    duration_sec: length > 0 ? Math.round(length) : null,
    caption,
    is_verified: true,
  });
  if (error) return bad("insert_failed", 500);

  await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", videoId);
  return NextResponse.json({ ok: true, participantId: up.participant_id });
}
