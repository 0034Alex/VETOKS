import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";
import { cleanNick } from "@/lib/nick";
import { pickText } from "@/lib/pushText";

export const dynamic = "force-dynamic";

const MAX_TAGS_PER_POST = 10;

// Отметки: поставить (владелица публикации), принять / скрыть / убрать (отмеченный), режим «подтверждать вручную».
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  if (action === "manual") {
    await supabaseAdmin.from("users").update({ tag_manual: !!b.on }).eq("id", me);
    return NextResponse.json({ ok: true });
  }

  if (action === "tag") {
    const postId = String(b.postId || "");
    const nick = cleanNick(b.nick);
    if (!postId || !nick) return bad("bad_request");
    const { data: post } = await supabaseAdmin
      .from("content_posts")
      .select("id, participant_id, user_id, participants(user_id, display_name)")
      .eq("id", postId)
      .maybeSingle();
    const pOwner: any = Array.isArray((post as any)?.participants) ? (post as any).participants[0] : (post as any)?.participants;
    const ownerId = (post as any)?.user_id ?? pOwner?.user_id;
    if (!post || ownerId !== me) return bad("forbidden", 403);

    const { data: target } = await supabaseAdmin
      .from("users")
      .select("id, tag_manual, is_banned")
      .eq("nick", nick)
      .maybeSingle();
    if (!target || target.is_banned || target.id === me) return bad("no_user", 404);
    if (!(await sameCountry(me, target.id as string))) return bad("no_user", 404);

    const { count } = await supabaseAdmin.from("content_tags").select("id", { count: "exact", head: true }).eq("post_id", postId);
    if ((count ?? 0) >= MAX_TAGS_PER_POST) return bad("too_many", 400);
    const { data: ex } = await supabaseAdmin
      .from("content_tags")
      .select("id")
      .eq("post_id", postId)
      .eq("tagged_user_id", target.id)
      .maybeSingle();
    if (ex) return NextResponse.json({ ok: true, already: true });

    const manual = !!(target as any).tag_manual;
    await supabaseAdmin.from("content_tags").insert({
      post_id: postId,
      tagged_user_id: target.id,
      tagger_id: me,
      status: manual ? "pending" : "approved",
    });
    let name = (pOwner?.display_name as string) || "";
    if (!name) {
      const { data: me0 } = await supabaseAdmin.from("users").select("first_name").eq("id", me).maybeSingle();
      name = (me0?.first_name as string) || "Гость";
    }
    const text = manual
      ? await pickText(target.id as string, {
          ru: `🏷 ${name} хочет вас отметить. Подтвердите в профиле → Отметки`,
          uk: `🏷 ${name} хоче вас позначити. Підтвердіть у профілі → Позначки`,
          en: `🏷 ${name} wants to tag you. Confirm in your profile → Tags`,
        })
      : await pickText(target.id as string, {
          ru: `🏷 ${name} отметила вас в публикации`,
          uk: `🏷 ${name} позначила вас у публікації`,
          en: `🏷 ${name} tagged you in a post`,
        });
    await notify(target.id as string, text, manual ? "/profile" : post.participant_id ? `/participant/${post.participant_id}` : `/post/${post.id}`, "other");
    return NextResponse.json({ ok: true, status: manual ? "pending" : "approved" });
  }

  const tagId = String(b.tagId || "");
  if (!tagId) return bad("bad_request");
  const { data: tg } = await supabaseAdmin.from("content_tags").select("id, tagged_user_id, tagger_id").eq("id", tagId).maybeSingle();
  if (!tg) return bad("not_found", 404);

  if (action === "accept" || action === "hide") {
    if (tg.tagged_user_id !== me) return bad("forbidden", 403);
    await supabaseAdmin.from("content_tags").update({ status: action === "accept" ? "approved" : "hidden" }).eq("id", tagId);
    return NextResponse.json({ ok: true });
  }
  if (action === "remove") {
    if (tg.tagged_user_id !== me && tg.tagger_id !== me) return bad("forbidden", 403);
    await supabaseAdmin.from("content_tags").delete().eq("id", tagId);
    return NextResponse.json({ ok: true });
  }
  return bad("bad_request");
}
