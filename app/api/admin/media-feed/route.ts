import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { settingsForCountry } from "@/lib/countryServer";
import { buildPool, themesFor } from "@/lib/mediaFeed";

export const dynamic = "force-dynamic";

const ok = (o: object = {}) => NextResponse.json({ ok: true, ...o });
const bad = (e: string, s = 400) => NextResponse.json({ ok: false, error: e }, { status: s });
const KEYS = ["media_quota_min", "media_quota_max"];

// CRM → «Лента»: темы (с датами), статистика по роликам, закрепить/скрыть, настройки.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin", "moderator"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const cid: string = typeof b.country_id === "string" && b.country_id ? b.country_id : "";

  if (b.action === "overview") {
    const { data: themes } = cid
      ? await supabaseAdmin.from("media_themes").select("*").or(`country_id.eq.${cid},country_id.is.null`).order("starts_at", { ascending: false }).limit(60)
      : await supabaseAdmin.from("media_themes").select("*").order("starts_at", { ascending: false }).limit(60);
    const settings = await settingsForCountry(KEYS, cid || null);
    const { data: av } = await supabaseAdmin.rpc("media_active_viewers", { p_since: new Date(Date.now() - 86400000).toISOString() });
    return ok({ themes: themes ?? [], settings, viewers24: Number(av ?? 0) });
  }

  if (b.action === "theme_save") {
    const title = String(b.title ?? "").trim().slice(0, 80);
    const s = new Date(b.starts_at);
    const e = new Date(b.ends_at);
    if (!title || isNaN(+s) || isNaN(+e) || e <= s) return bad("bad_input");
    const rec = { country_id: cid || null, title, kind: b.kind === "casting" ? "casting" : "theme", starts_at: s.toISOString(), ends_at: e.toISOString() };
    if (b.id) {
      const { error } = await supabaseAdmin.from("media_themes").update(rec).eq("id", String(b.id));
      if (error) return bad("save_failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("media_themes").insert(rec);
      if (error) return bad("save_failed", 500);
    }
    await logAction(uid, "media_theme_save", null, { title });
    return ok();
  }

  if (b.action === "theme_delete") {
    await supabaseAdmin.from("media_themes").delete().eq("id", String(b.id ?? ""));
    await logAction(uid, "media_theme_delete", null, { id: b.id });
    return ok();
  }

  if (b.action === "stats") {
    // ролики темы (или все, если тема не выбрана): показы, досмотры, лайки, вес
    let q = supabaseAdmin
      .from("content_posts")
      .select("id, caption, submitted_at, theme_id, participants(display_name)")
      .not("video_url", "is", null)
      .not("participant_id", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(300);
    if (b.theme_id) q = q.eq("theme_id", String(b.theme_id));
    const { data: posts } = await q;
    const ids = ((posts ?? []) as any[]).map((p) => p.id as string);
    const stats = new Map<string, any>();
    const counts = new Map<string, any>();
    if (ids.length) {
      const { data: st } = await supabaseAdmin.from("media_post_stats").select("*").in("post_id", ids);
      (st ?? []).forEach((s: any) => stats.set(s.post_id, s));
      const { data: ct } = await supabaseAdmin.rpc("media_counts", { p_ids: ids });
      ((ct as any[]) ?? []).forEach((c) => counts.set(c.post_id, c));
    }
    const items = ((posts ?? []) as any[]).map((p) => {
      const s = stats.get(p.id) ?? {};
      const c = counts.get(p.id) ?? {};
      const pt = Array.isArray(p.participants) ? p.participants[0] : p.participants;
      return {
        id: p.id,
        name: pt?.display_name ?? "—",
        caption: p.caption ?? "",
        at: p.submitted_at,
        impressions: Number(s.impressions ?? 0),
        qualified: Number(s.qualified ?? 0),
        completes: Number(s.completes ?? 0),
        likes: Number(c.likes ?? 0),
        comments: Number(c.comments ?? 0),
        weight: Number(s.weight ?? 0),
        pinned: !!s.pinned,
        hidden: !!s.hidden,
      };
    });
    return ok({ items });
  }

  if (b.action === "flag") {
    const id = String(b.post_id ?? "");
    if (!id) return bad("bad_input");
    const rec: any = { post_id: id };
    if (typeof b.pinned === "boolean") rec.pinned = b.pinned;
    if (typeof b.hidden === "boolean") rec.hidden = b.hidden;
    await supabaseAdmin.from("media_post_stats").upsert(rec, { onConflict: "post_id" });
    await logAction(uid, "media_flag", id, rec);
    return ok();
  }

  if (b.action === "settings_save") {
    const rows = KEYS.filter((k) => b[k] !== undefined && b[k] !== "").map((k) => ({ key: cid ? `${k}:${cid}` : k, value: String(Math.max(0, Math.min(100000, Math.round(Number(b[k]) || 0)))) }));
    if (rows.length) await supabaseAdmin.from("platform_settings").upsert(rows, { onConflict: "key" });
    await logAction(uid, "media_settings", null, { cid });
    return ok();
  }

  if (b.action === "rebuild") {
    if (!cid) return bad("no_country");
    try {
      const n = await buildPool(cid);
      const t = await themesFor(cid);
      return ok({ rows: n, active: t.active?.title ?? null });
    } catch (e: any) {
      return bad(String(e?.message || "failed").slice(0, 120), 500);
    }
  }

  return bad("unknown_action");
}
