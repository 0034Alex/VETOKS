import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { bunnyDeleteVideo } from "@/lib/bunny";

export const dynamic = "force-dynamic";
const ok = (o: object = {}) => NextResponse.json({ ok: true, ...o });
const bad = (e: string, s = 400) => NextResponse.json({ ok: false, error: e }, { status: s });

// CRM → «Каналы»: жалобы, поиск каналов, скрыть пост/комментарий, заморозить канал, забанить владельца.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin", "moderator"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "overview") {
    const q = String(b.q ?? "").trim().toLowerCase();
    let cq = supabaseAdmin.from("channels").select("id, slug, name, kind, subs_count, frozen, owner_id, created_at").order("created_at", { ascending: false }).limit(60);
    if (q) cq = cq.or(`slug.ilike.%${q.replace(/[%,]/g, "")}%,name.ilike.%${q.replace(/[%,]/g, "")}%`);
    const { data: chs } = await cq;
    const { data: reps } = await supabaseAdmin.from("channel_reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100);
    const items: any[] = [];
    for (const r of (reps ?? []) as any[]) {
      const { data: ch } = await supabaseAdmin.from("channels").select("name, slug, owner_id, frozen").eq("id", r.channel_id).maybeSingle();
      let text = "";
      if (r.comment_id) text = (await supabaseAdmin.from("channel_comments").select("body").eq("id", r.comment_id).maybeSingle()).data?.body ?? "(удалён)";
      else if (r.post_id) { const p: any = (await supabaseAdmin.from("channel_posts").select("body, photo_url, video_url").eq("id", r.post_id).maybeSingle()).data; text = p ? p.body || p.photo_url || p.video_url || "" : "(удалён)"; }
      items.push({ ...r, channel: ch, text });
    }
    return ok({ channels: chs ?? [], reports: items });
  }

  if (b.action === "hide") {
    if (b.commentId) await supabaseAdmin.from("channel_comments").update({ hidden: true }).eq("id", String(b.commentId));
    if (b.postId) await supabaseAdmin.from("channel_posts").update({ hidden: true }).eq("id", String(b.postId));
    await logAction(uid, "channel_hide", String(b.postId || b.commentId || ""), {});
    return ok();
  }
  if (b.action === "dismiss") {
    await supabaseAdmin.from("channel_reports").update({ status: "closed" }).eq("id", String(b.id));
    return ok();
  }
  if (b.action === "freeze") {
    await supabaseAdmin.from("channels").update({ frozen: !!b.frozen }).eq("id", String(b.id));
    await logAction(uid, b.frozen ? "channel_freeze" : "channel_unfreeze", String(b.id), {});
    return ok();
  }
  if (b.action === "ban_owner") {
    const { data: ch } = await supabaseAdmin.from("channels").select("owner_id").eq("id", String(b.id)).maybeSingle();
    if (!ch) return bad("not_found", 404);
    await supabaseAdmin.from("users").update({ is_banned: true }).eq("id", ch.owner_id);
    await supabaseAdmin.from("channels").update({ frozen: true }).eq("owner_id", ch.owner_id);
    await logAction(uid, "channel_ban_owner", String(ch.owner_id), { channel: b.id });
    return ok();
  }
  if (b.action === "delete") {
    const id = String(b.id);
    const { data: ps } = await supabaseAdmin.from("channel_posts").select("id, video_id").eq("channel_id", id).limit(5000);
    for (const p of (ps ?? []) as any[]) if (p.video_id) await bunnyDeleteVideo(p.video_id);
    const pids = (ps ?? []).map((p: any) => p.id);
    if (pids.length) {
      await supabaseAdmin.from("channel_comments").delete().in("post_id", pids);
      await supabaseAdmin.from("channel_reactions").delete().in("post_id", pids);
      await supabaseAdmin.from("channel_views").delete().in("post_id", pids);
    }
    await supabaseAdmin.from("channel_posts").delete().eq("channel_id", id);
    await supabaseAdmin.from("channel_members").delete().eq("channel_id", id);
    await supabaseAdmin.from("channel_reports").delete().eq("channel_id", id);
    await supabaseAdmin.from("channels").delete().eq("id", id);
    await logAction(uid, "channel_delete", id, {});
    return ok();
  }
  return bad("unknown_action");
}
