import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { notify } from "@/lib/shopServer";
import { regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// CRM → «Проверка контента»: публикации на проверке и недавние, одобрить или скрыть (18+ и т.п.).
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "mode_get") {
    const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", "moderation_mode").maybeSingle();
    return NextResponse.json({ ok: true, mode: (data as any)?.value === "before" ? "before" : "after" });
  }

  if (b.action === "mode_set") {
    const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
    if ((me as any)?.role !== "super_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const mode = b.mode === "before" ? "before" : "after";
    await supabaseAdmin.from("platform_settings").upsert({ key: "moderation_mode", value: mode }, { onConflict: "key" });
    await logAction(uid, "moderation_mode", null, { mode });
    return NextResponse.json({ ok: true, mode });
  }

  if (b.action === "list") {
    const kind = b.kind === "recent" ? "recent" : "pending";
    let q = supabaseAdmin
      .from("content_posts")
      .select("id, user_id, participant_id, photo_url, video_url, extra_media, caption, submitted_at, mod_status, mod_reason")
      .order("submitted_at", { ascending: false })
      .limit(kind === "pending" ? 100 : 40);
    q = kind === "pending" ? q.eq("mod_status", "pending") : q.eq("mod_status", "ok");
    const { data: posts, error } = await q;
    if (error) return NextResponse.json({ ok: true, items: [], needSql: true });
    const uids = Array.from(new Set((posts ?? []).map((p: any) => p.user_id).filter(Boolean)));
    const { data: us } = uids.length
      ? await supabaseAdmin.from("users").select("id, first_name, region_id").in("id", uids as string[])
      : { data: [] as any[] };
    const um = new Map<string, any>(((us ?? []) as any[]).map((u: any) => [u.id, u]));
    const rids = b.countryId ? new Set(await regionIdsOfCountry(String(b.countryId))) : null;
    const items = (posts ?? [])
      .filter((p: any) => !rids || !um.get(p.user_id)?.region_id || rids.has(um.get(p.user_id).region_id))
      .map((p: any) => ({ ...p, author: um.get(p.user_id)?.first_name ?? "—" }));
    return NextResponse.json({ ok: true, items });
  }

  if (b.action === "set") {
    const postId = String(b.postId ?? "");
    const status = b.status === "hidden" ? "hidden" : "ok";
    const reason = String(b.reason ?? "").slice(0, 200) || (status === "hidden" ? "18+ / нарушение правил" : "");
    if (!postId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    const { data: post } = await supabaseAdmin.from("content_posts").select("id, user_id").eq("id", postId).maybeSingle();
    if (!post) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const { error } = await supabaseAdmin
      .from("content_posts")
      .update({ mod_status: status, mod_reason: reason || null, mod_by: uid, mod_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
    if (status === "ok") {
      await supabaseAdmin
        .from("content_reports")
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("post_id", postId)
        .eq("status", "open");
      if (b.notify !== false && (post as any).user_id) {
        await notify((post as any).user_id, "✅ Ваша публикация прошла проверку и видна всем.", "/profile");
      }
    } else if ((post as any).user_id) {
      await notify(
        (post as any).user_id,
        "⛔ Публикация скрыта модератором: она нарушает правила (откровенный или недопустимый контент). Если это ошибка, напишите в поддержку.",
        "/support"
      );
    }
    await logAction(uid, status === "hidden" ? "post_hide" : "post_approve", postId, { reason });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
