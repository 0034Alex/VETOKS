import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { bunnyDeleteVideo } from "@/lib/bunny";

export const dynamic = "force-dynamic";

// CRM → «Жалобы»: список, «оставить» (закрыть жалобы), «удалить ролик».
export async function POST(req: Request) {
  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: u } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  if (!u || !["moderator", "super_admin"].includes(u.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "list") {
    const { data: reps } = await supabaseAdmin
      .from("content_reports")
      .select("id, post_id, reason, details, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(300);
    const byPost = new Map<string, any>();
    for (const r of reps ?? []) {
      const g = byPost.get(r.post_id) ?? { post_id: r.post_id, count: 0, reasons: {}, last: r.created_at, details: [] as string[] };
      g.count += 1;
      g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
      if (r.details) g.details.push(r.details);
      byPost.set(r.post_id, g);
    }
    const ids = Array.from(byPost.keys());
    const { data: posts } = ids.length
      ? await supabaseAdmin
          .from("content_posts")
          .select("id, video_url, photo_url, caption, participants(display_name)")
          .in("id", ids)
      : { data: [] as any[] };
    const pm = new Map((posts ?? []).map((p: any) => [p.id, p]));
    const items = Array.from(byPost.values())
      .map((g) => ({ ...g, post: pm.get(g.post_id) ?? null }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json({ ok: true, items });
  }

  const postId = String(body.postId ?? "");
  if (!postId) return NextResponse.json({ ok: false }, { status: 400 });

  if (action === "keep") {
    await supabaseAdmin
      .from("content_reports")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("post_id", postId)
      .eq("status", "open");
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { data: post } = await supabaseAdmin
      .from("content_posts")
      .select("bunny_video_id")
      .eq("id", postId)
      .maybeSingle();
    if (post?.bunny_video_id) await bunnyDeleteVideo(post.bunny_video_id);
    await supabaseAdmin.from("content_posts").delete().eq("id", postId);
    await supabaseAdmin
      .from("content_reports")
      .update({ status: "deleted", resolved_at: new Date().toISOString() })
      .eq("post_id", postId)
      .eq("status", "open");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
