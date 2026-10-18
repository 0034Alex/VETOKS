import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { bunnyCfg, bunnyCreateVideo, bunnySignature } from "@/lib/bunny";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Шаг 1: участница хочет загрузить видео. Создаём место в Bunny и даём подпись.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "video/create-upload", 12, 600, uid);
  if (rl) return rl;

  const cfg = bunnyCfg();
  if (!cfg) return NextResponse.json({ ok: true, configured: false });

  const { data: p } = await supabaseAdmin
    .from("participants")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();
  if (!p) return bad("not_participant", 403);

  const guid = await bunnyCreateVideo(`vetoks-${p.id}-${Date.now()}`);
  if (!guid) return bad("bunny_failed", 502);

  await supabaseAdmin
    .from("video_uploads")
    .insert({ video_id: guid, user_id: uid, participant_id: p.id });

  const expire = Math.floor(Date.now() / 1000) + 60 * 60;
  return NextResponse.json({
    ok: true,
    configured: true,
    videoId: guid,
    libraryId: cfg.lib,
    expire,
    signature: bunnySignature(guid, expire),
  });
}
