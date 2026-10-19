import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

// CRM → «Жалобы» → жалобы на комментарии: список, «оставить», «удалить комментарий».
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const { data: reps, error } = await supabaseAdmin
      .from("comment_reports")
      .select("id, comment_id, reason, details, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) return NextResponse.json({ ok: true, items: [], needSql: true });
    const by = new Map<string, { comment_id: string; count: number; reasons: Record<string, number>; details: string[] }>();
    for (const r of (reps ?? []) as any[]) {
      const g = by.get(r.comment_id) ?? { comment_id: r.comment_id, count: 0, reasons: {} as Record<string, number>, details: [] as string[] };
      g.count++;
      g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
      if (r.details) g.details.push(r.details);
      by.set(r.comment_id, g);
    }
    const ids = Array.from(by.keys());
    const { data: cs } = ids.length
      ? await supabaseAdmin.from("media_comments").select("id, body, user_id, post_id, created_at").in("id", ids)
      : { data: [] as any[] };
    const cm = new Map<string, any>(((cs ?? []) as any[]).map((c: any) => [String(c.id), c]));
    // Комментарий уже удалён автором — жалобы закрываем сами.
    const gone = ids.filter((id) => !cm.has(String(id)));
    if (gone.length) {
      await supabaseAdmin
        .from("comment_reports")
        .update({ status: "deleted", resolved_at: new Date().toISOString() })
        .in("comment_id", gone)
        .eq("status", "open");
    }
    const uids = Array.from(new Set(((cs ?? []) as any[]).map((c: any) => c.user_id).filter(Boolean)));
    const { data: us } = uids.length
      ? await supabaseAdmin.from("users").select("id, first_name").in("id", uids as string[])
      : { data: [] as any[] };
    const un = new Map<string, string>(((us ?? []) as any[]).map((u: any) => [u.id, u.first_name]));
    const items = Array.from(by.values())
      .filter((g) => cm.has(String(g.comment_id)))
      .map((g) => {
        const c = cm.get(String(g.comment_id));
        return { ...g, body: c.body as string, author: un.get(c.user_id) ?? "—", authorId: c.user_id as string, postId: c.post_id as string };
      })
      .sort((a, b2) => b2.count - a.count);
    return NextResponse.json({ ok: true, items });
  }

  const commentId = String(b.commentId ?? "");
  if (!commentId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  if (b.action === "keep") {
    await supabaseAdmin
      .from("comment_reports")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("comment_id", commentId)
      .eq("status", "open");
    await logAction(uid, "comment_keep", commentId);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete") {
    await supabaseAdmin.from("media_comments").delete().eq("id", commentId);
    await supabaseAdmin
      .from("comment_reports")
      .update({ status: "deleted", resolved_at: new Date().toISOString() })
      .eq("comment_id", commentId)
      .eq("status", "open");
    await logAction(uid, "comment_delete", commentId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
