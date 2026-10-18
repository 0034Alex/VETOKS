import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { cleanVisibility } from "@/lib/postVisibility";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
const MAX = 20;

// Черновики публикаций: видны только автору.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const rl = await rateLimit(req, "post/drafts", 40, 60, me);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "list");

  if (action === "list") {
    const { data } = await supabaseAdmin
      .from("post_drafts")
      .select("id, caption, media, updated_at")
      .eq("user_id", me)
      .order("updated_at", { ascending: false })
      .limit(MAX);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }
  if (action === "get") {
    const { data } = await supabaseAdmin
      .from("post_drafts")
      .select("id, caption, media, visibility, place_id, place_name, tags, settings")
      .eq("id", String(b.id || ""))
      .eq("user_id", me)
      .maybeSingle();
    if (!data) return bad("not_found", 404);
    return NextResponse.json({ ok: true, draft: data });
  }
  if (action === "delete") {
    await supabaseAdmin.from("post_drafts").delete().eq("id", String(b.id || "")).eq("user_id", me);
    return NextResponse.json({ ok: true });
  }
  if (action === "save") {
    const media = Array.isArray(b.media) ? b.media.slice(0, 10) : [];
    const tags = Array.isArray(b.tags) ? b.tags.map(String).slice(0, 10) : [];
    if (!media.length && !String(b.caption || "").trim()) return bad("empty");
    const rec = {
      user_id: me,
      caption: String(b.caption ?? "").slice(0, 500),
      media,
      visibility: cleanVisibility(b.visibility),
      place_id: b.placeId ? String(b.placeId) : null,
      place_name: b.placeName ? String(b.placeName).slice(0, 60) : null,
      tags,
      settings: b.settings && typeof b.settings === "object" ? { comments: b.settings.comments !== false, likes: b.settings.likes !== false, reposts: b.settings.reposts !== false } : null,
      updated_at: new Date().toISOString(),
    };
    if (b.id) {
      const { error } = await supabaseAdmin.from("post_drafts").update(rec).eq("id", String(b.id)).eq("user_id", me);
      if (error) return bad("save_failed", 500);
      return NextResponse.json({ ok: true, id: String(b.id) });
    }
    const { count } = await supabaseAdmin.from("post_drafts").select("id", { count: "exact", head: true }).eq("user_id", me);
    if ((count ?? 0) >= MAX) return bad("too_many");
    const { data, error } = await supabaseAdmin.from("post_drafts").insert(rec).select("id").maybeSingle();
    if (error || !data) return bad("save_failed", 500);
    return NextResponse.json({ ok: true, id: data.id });
  }
  return bad("bad_request");
}
