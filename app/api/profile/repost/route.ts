import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";
import { pickText } from "@/lib/pushText";

export const dynamic = "force-dynamic";

// Репост чужого фото или видео в свой профиль (раздел «Репосты»). Повторный вызов с on=false убирает репост.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const postId = String(b.postId || "");
  const on = b.on !== false;
  if (!postId) return bad("bad_request");

  const { data: post } = await supabaseAdmin
    .from("content_posts")
    .select("id, participant_id, participants(user_id, display_name)")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return bad("not_found", 404);
  const owner: any = Array.isArray((post as any).participants) ? (post as any).participants[0] : (post as any).participants;
  if (!owner?.user_id) return bad("not_found", 404);
  if (owner.user_id === me) return bad("own_post", 400);
  if (!(await sameCountry(me, owner.user_id))) return bad("not_found", 404);

  if (!on) {
    await supabaseAdmin.from("content_reposts").delete().eq("user_id", me).eq("post_id", postId);
    return NextResponse.json({ ok: true, on: false });
  }

  const { data: ex } = await supabaseAdmin.from("content_reposts").select("id").eq("user_id", me).eq("post_id", postId).maybeSingle();
  if (!ex) {
    await supabaseAdmin.from("content_reposts").insert({ user_id: me, post_id: postId });
    const { data: u } = await supabaseAdmin.from("users").select("first_name, nick").eq("id", me).maybeSingle();
    const name = (u?.first_name as string) || (u?.nick as string) || "Гость";
    const text = await pickText(owner.user_id, {
      ru: `🔁 ${name} сделал(а) репост вашей публикации`,
      uk: `🔁 ${name} зробив(ла) репост вашої публікації`,
      en: `🔁 ${name} reposted your post`,
    });
    await notify(owner.user_id as string, text, `/participant/${post.participant_id}`, "other");
  }
  return NextResponse.json({ ok: true, on: true });
}
