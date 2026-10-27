import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { bunnyDeleteVideo } from "@/lib/bunny";
import { parseStorageUrl } from "@/lib/fileCheck";

export const dynamic = "force-dynamic";

// CRM → «Жалобы на истории»: список, «оставить», «удалить».
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const { data: reps } = await supabaseAdmin
      .from("story_reports")
      .select("story_id, reason, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(500);
    const by = new Map<string, { story_id: string; count: number; reasons: Record<string, number>; last: string }>();
    for (const r of (reps as any[]) ?? []) {
      const g = by.get(r.story_id) ?? { story_id: r.story_id, count: 0, reasons: {}, last: r.created_at };
      g.count += 1;
      g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
      by.set(r.story_id, g);
    }
    const ids = Array.from(by.keys());
    const { data: st } = ids.length
      ? await supabaseAdmin.from("stories").select("id, user_id, kind, url, hidden, created_at, expires_at").in("id", ids)
      : { data: [] as any[] };
    const uids = Array.from(new Set(((st as any[]) ?? []).map((s) => s.user_id)));
    const { data: us } = uids.length ? await supabaseAdmin.from("users").select("id, first_name, nick").in("id", uids) : { data: [] as any[] };
    const nm = new Map(((us as any[]) ?? []).map((u) => [u.id, u.first_name || u.nick || ""]));
    const items = ((st as any[]) ?? [])
      .map((s) => ({ ...by.get(s.id)!, story: { ...s, author: nm.get(s.user_id) ?? "" } }))
      .sort((a, c) => c.count - a.count);
    return NextResponse.json({ ok: true, items });
  }

  const id = String(b.id || "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (b.action === "keep") {
    await supabaseAdmin.from("story_reports").update({ status: "closed" }).eq("story_id", id);
    await supabaseAdmin.from("stories").update({ hidden: false }).eq("id", id);
    await logAction(uid, "story_keep", id, {});
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete") {
    const { data: s } = await supabaseAdmin.from("stories").select("id, url, video_id").eq("id", id).maybeSingle();
    if (s) {
      if (s.video_id) await bunnyDeleteVideo(String(s.video_id));
      else {
        const p = parseStorageUrl(String(s.url));
        if (p) await supabaseAdmin.storage.from(p.bucket).remove([p.name]);
      }
      await supabaseAdmin.from("stories").delete().eq("id", id);
    }
    await logAction(uid, "story_delete", id, {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
