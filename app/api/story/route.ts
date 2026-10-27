import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { bunnyCfg, bunnyDeleteVideo, bunnyGetVideo, bunnyPlayUrl } from "@/lib/bunny";
import { verifyStoredFile } from "@/lib/fileCheck";
import { checkImageNsfw } from "@/lib/nsfw";
import { countryOfUser, settingsForCountry } from "@/lib/countryServer";
import { rateLimit } from "@/lib/rateLimit";
import { logSecurity } from "@/lib/security";
import { cleanNick } from "@/lib/nick";

export const dynamic = "force-dynamic";

const MAX_ACTIVE = 10;
const MAX_SEC = 30;
const VIS = ["all", "followers", "friends"];

async function authors(ids: string[]) {
  const out: Record<string, { name: string; photo: string | null; participantId: string | null }> = {};
  if (!ids.length) return out;
  const { data: us } = await supabaseAdmin.from("users").select("id, first_name, nick, photo_url").in("id", ids);
  (us ?? []).forEach((u: any) => (out[u.id] = { name: u.first_name || u.nick || "", photo: u.photo_url ?? null, participantId: null }));
  const { data: ps } = await supabaseAdmin.from("participants").select("id, user_id, display_name, photo_url").in("user_id", ids);
  (ps ?? []).forEach((p: any) => {
    out[p.user_id] = { name: p.display_name || out[p.user_id]?.name || "", photo: p.photo_url ?? out[p.user_id]?.photo ?? null, participantId: p.id };
  });
  return out;
}

// Истории: лента подписок, публикация, просмотры, «избранные друзья».
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const rl = await rateLimit(req, "story", 120, 60, me);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "feed");
  const now = new Date().toISOString();

  if (action === "feed") {
    // на кого я подписан
    const ids = new Set<string>();
    const { data: uf } = await supabaseAdmin.from("user_follows").select("followed_id").eq("follower_id", me).limit(500);
    (uf ?? []).forEach((r: any) => ids.add(r.followed_id));
    const { data: pf } = await supabaseAdmin.from("participant_follows").select("participant_id").eq("user_id", me).limit(500);
    const pids = (pf ?? []).map((r: any) => r.participant_id);
    if (pids.length) {
      const { data: ps } = await supabaseAdmin.from("participants").select("user_id").in("id", pids);
      (ps ?? []).forEach((r: any) => r.user_id && ids.add(r.user_id));
    }
    ids.delete(me);
    const list = Array.from(ids);
    let rows: any[] = [];
    if (list.length) {
      const { data } = await supabaseAdmin
        .from("stories")
        .select("id, user_id, kind, url, visibility, created_at, expires_at")
        .in("user_id", list)
        .gt("expires_at", now)
        .order("created_at", { ascending: true })
        .limit(500);
      rows = data ?? [];
    }
    // «избранные друзья»: показываем, только если автор добавил меня
    const friendOwners = new Set<string>();
    if (rows.some((r) => r.visibility === "friends")) {
      const { data: fr } = await supabaseAdmin.from("story_friends").select("owner_id").eq("friend_id", me);
      (fr ?? []).forEach((r: any) => friendOwners.add(r.owner_id));
    }
    rows = rows.filter((r) => r.visibility !== "friends" || friendOwners.has(r.user_id));
    const ids2 = rows.map((r) => r.id);
    const seen = new Set<string>();
    if (ids2.length) {
      const { data: sv } = await supabaseAdmin.from("story_views").select("story_id").eq("viewer_id", me).in("story_id", ids2);
      (sv ?? []).forEach((r: any) => seen.add(r.story_id));
    }
    const { data: mine } = await supabaseAdmin
      .from("stories")
      .select("id, user_id, kind, url, visibility, created_at, expires_at")
      .eq("user_id", me)
      .gt("expires_at", now)
      .order("created_at", { ascending: true });
    const au = await authors(Array.from(new Set([me, ...rows.map((r) => r.user_id)])));
    const groups: any[] = [];
    for (const r of rows) {
      let g = groups.find((x) => x.userId === r.user_id);
      if (!g) {
        g = { userId: r.user_id, ...au[r.user_id], stories: [], unseen: false };
        groups.push(g);
      }
      const s = seen.has(r.id);
      g.stories.push({ id: r.id, kind: r.kind, url: r.url, createdAt: r.created_at, seen: s });
      if (!s) g.unseen = true;
    }
    groups.sort((a, c) => Number(c.unseen) - Number(a.unseen));
    return NextResponse.json({
      ok: true,
      mine: { userId: me, ...au[me], stories: (mine ?? []).map((r: any) => ({ id: r.id, kind: r.kind, url: r.url, createdAt: r.created_at, visibility: r.visibility })) },
      groups,
    });
  }

  if (action === "create") {
    const m = b.media ?? {};
    const kind = m.kind === "video" ? "video" : "photo";
    const visibility = VIS.includes(b.visibility) ? b.visibility : "all";

    const cid = await countryOfUser(me);
    const gate = await settingsForCountry(["publishing_enabled", "moderation_mode"], cid);
    if (gate.publishing_enabled === "false" || gate.moderation_mode === "before") return bad("unavailable");

    const { count } = await supabaseAdmin.from("stories").select("id", { count: "exact", head: true }).eq("user_id", me).gt("expires_at", now);
    if ((count ?? 0) >= MAX_ACTIVE) return bad("too_many");

    let url = "";
    let videoId: string | null = null;
    let dur: number | null = null;
    if (kind === "video" && m.videoId) {
      const { data: up } = await supabaseAdmin.from("video_uploads").select("video_id, user_id, used").eq("video_id", String(m.videoId)).maybeSingle();
      if (!up || up.user_id !== me) return bad("not_yours", 403);
      if (up.used) return bad("already_used");
      const info = await bunnyGetVideo(String(m.videoId));
      if (!info) return bad("bunny_failed", 502);
      const len = Number(info.length ?? 0);
      if (len > MAX_SEC + 1) {
        await bunnyDeleteVideo(String(m.videoId));
        await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", String(m.videoId));
        return bad("too_long");
      }
      url = bunnyPlayUrl(String(m.videoId));
      videoId = String(m.videoId);
      dur = len > 0 ? Math.round(len) : null;
    } else {
      url = String(m.url ?? "");
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
      const prefix = `${base}/storage/v1/object/public/`;
      const rest = base && url.startsWith(prefix) ? url.slice(prefix.length) : "";
      const [bucket, ...parts] = rest.split("/");
      const fname = parts.join("/");
      if (!(bucket === "participant-photos" || bucket === "media-videos") || !fname.startsWith(`${me}-`)) {
        await logSecurity("bad_upload_url", { url: url.slice(0, 120), where: "story" }, { req, userId: me });
        return bad("bad_url");
      }
      if (!(await verifyStoredFile(url, kind === "video" ? "video" : "image"))) return bad("bad_file");
    }
    // 18+: фото проверяем сразу, у видео проверяем кадр-превью (если Bunny уже его сделал).
    {
      let probe: string | null = kind === "photo" ? url : null;
      if (kind === "video" && videoId) {
        const c = bunnyCfg();
        if (c) {
          const th = `https://${c.cdn}/${videoId}/thumbnail.jpg`;
          try {
            const h = await fetch(th, { method: "HEAD" });
            if (h.ok) probe = th;
          } catch {}
        }
      }
      if (probe) {
        const r = await checkImageNsfw(probe);
        if (r?.flag) {
          if (videoId) {
            await bunnyDeleteVideo(videoId);
            await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", videoId);
          }
          return bad("held");
        }
      }
    }
    const exp = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("stories")
      .insert({ user_id: me, kind, url, video_id: videoId, duration_sec: dur, visibility, expires_at: exp })
      .select("id")
      .maybeSingle();
    if (error || !row) return bad("insert_failed", 500);
    if (videoId) await supabaseAdmin.from("video_uploads").update({ used: true }).eq("video_id", videoId);
    // Уведомления: если за последние 6 часов у автора не было других историй.
    try {
      const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { count: recent } = await supabaseAdmin.from("stories").select("id", { count: "exact", head: true }).eq("user_id", me).gt("created_at", since);
      if ((recent ?? 0) <= 1) {
        const rec = new Set<string>();
        if (visibility === "friends") {
          const { data: fr } = await supabaseAdmin.from("story_friends").select("friend_id").eq("owner_id", me).limit(300);
          (fr ?? []).forEach((r: any) => rec.add(r.friend_id));
        } else {
          const { data: uf } = await supabaseAdmin.from("user_follows").select("follower_id").eq("followed_id", me).limit(300);
          (uf ?? []).forEach((r: any) => rec.add(r.follower_id));
          const { data: part } = await supabaseAdmin.from("participants").select("id").eq("user_id", me).maybeSingle();
          if (part) {
            const { data: pf } = await supabaseAdmin.from("participant_follows").select("user_id").eq("participant_id", part.id).limit(300);
            (pf ?? []).forEach((r: any) => rec.add(r.user_id));
          }
        }
        rec.delete(me);
        const au = await authors([me]);
        const who = au[me]?.name || "Новая история";
        const rows = Array.from(rec).slice(0, 300).map((uid2) => ({ user_id: uid2, message: `${who}: новая история`, link: "/" }));
        if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
      }
    } catch {}
    if (b.draftId) await supabaseAdmin.from("post_drafts").delete().eq("id", String(b.draftId)).eq("user_id", me);
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "delete") {
    const { data: s } = await supabaseAdmin.from("stories").select("id, video_id").eq("id", String(b.id || "")).eq("user_id", me).maybeSingle();
    if (!s) return bad("not_found", 404);
    await supabaseAdmin.from("stories").delete().eq("id", s.id);
    if (s.video_id) await bunnyDeleteVideo(String(s.video_id));
    return NextResponse.json({ ok: true });
  }

  if (action === "view") {
    const id = String(b.id || "");
    const { data: s } = await supabaseAdmin.from("stories").select("id, user_id").eq("id", id).maybeSingle();
    if (s && s.user_id !== me) await supabaseAdmin.from("story_views").upsert({ story_id: id, viewer_id: me }, { onConflict: "story_id,viewer_id" });
    return NextResponse.json({ ok: true });
  }

  if (action === "viewers") {
    const { data: s } = await supabaseAdmin.from("stories").select("id").eq("id", String(b.id || "")).eq("user_id", me).maybeSingle();
    if (!s) return bad("not_found", 404);
    const { data: v } = await supabaseAdmin.from("story_views").select("viewer_id").eq("story_id", s.id).limit(200);
    const au = await authors((v ?? []).map((r: any) => r.viewer_id));
    return NextResponse.json({ ok: true, items: Object.values(au).map((a) => ({ name: a.name, photo: a.photo })) });
  }

  if (action === "friends") {
    const { data: fr } = await supabaseAdmin.from("story_friends").select("friend_id").eq("owner_id", me).limit(300);
    const au = await authors((fr ?? []).map((r: any) => r.friend_id));
    return NextResponse.json({ ok: true, items: (fr ?? []).map((r: any) => ({ id: r.friend_id, ...au[r.friend_id] })) });
  }
  if (action === "friend_add") {
    const nick = cleanNick(b.nick);
    const { data: u } = await supabaseAdmin.from("users").select("id").eq("nick", nick).maybeSingle();
    if (!u || u.id === me) return bad("not_found", 404);
    const { count } = await supabaseAdmin.from("story_friends").select("friend_id", { count: "exact", head: true }).eq("owner_id", me);
    if ((count ?? 0) >= 300) return bad("too_many");
    await supabaseAdmin.from("story_friends").upsert({ owner_id: me, friend_id: u.id }, { onConflict: "owner_id,friend_id" });
    return NextResponse.json({ ok: true });
  }
  if (action === "friend_remove") {
    await supabaseAdmin.from("story_friends").delete().eq("owner_id", me).eq("friend_id", String(b.id || ""));
    return NextResponse.json({ ok: true });
  }
  return bad("bad_action");
}
