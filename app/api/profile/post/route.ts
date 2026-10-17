import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Одна публикация (для просмотра публикаций обычных людей).
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const id = String(b.postId || "");
  if (!id) return bad("bad_request");

  const { data: p } = await supabaseAdmin
    .from("content_posts")
    .select("id, participant_id, user_id, video_url, photo_url, caption, participants(user_id, display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!p) return bad("not_found", 404);
  const pp: any = Array.isArray((p as any).participants) ? (p as any).participants[0] : (p as any).participants;
  const ownerId: string | undefined = (p as any).user_id ?? pp?.user_id;
  if (!ownerId) return bad("not_found", 404);
  if (ownerId !== me && !(await sameCountry(me, ownerId))) return bad("not_found", 404);

  const { data: u } = await supabaseAdmin.from("users").select("first_name, nick, photo_url").eq("id", ownerId).maybeSingle();
  return NextResponse.json({
    ok: true,
    post: {
      id: p.id,
      kind: (p as any).video_url ? "video" : "photo",
      url: (p as any).video_url || (p as any).photo_url,
      caption: (p as any).caption ?? "",
      ownerUserId: ownerId,
      authorName: pp?.display_name ?? u?.first_name ?? "Гость",
      authorPhoto: u?.photo_url ?? null,
      authorHref: p.participant_id ? `/participant/${p.participant_id}` : `/u/${ownerId}`,
      mine: ownerId === me,
    },
    meId: me,
  });
}
