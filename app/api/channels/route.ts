import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { hasBadWords, BAD_WORDS_MESSAGE } from "@/lib/badWords";
import { checkImageNsfw } from "@/lib/nsfw";
import { parseStorageUrl, verifyStoredFile } from "@/lib/fileCheck";
import { bunnyCfg, bunnyCreateVideo, bunnyDeleteVideo, bunnyGetVideo, bunnyPlayUrl, bunnySignature } from "@/lib/bunny";
import { Ch, EMOJIS, LINK_RE, cleanSlug, fanoutPost, getChannel, memberStatus, slugOk, userFlags } from "@/lib/channelsServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ok = (o: object = {}) => NextResponse.json({ ok: true, ...o });
const REASONS = ["spam", "nudity", "violence", "hate", "scam", "fake", "minor", "illegal", "selfharm", "ip", "other"];
const AUDIO_MAX = 5 * 1024 * 1024;

async function ownFile(url: string, uid: string, bucket: string): Promise<boolean> {
  const p = parseStorageUrl(url);
  return !!p && p.bucket === bucket && p.name.startsWith(`${uid}-`);
}
async function removeFile(url: string) {
  const p = parseStorageUrl(url);
  if (p) await supabaseAdmin.storage.from(p.bucket).remove([p.name]);
}
async function authorNames(ids: string[]) {
  const m: Record<string, string> = {};
  if (!ids.length) return m;
  const { data } = await supabaseAdmin.from("users").select("id, first_name, nick").in("id", ids);
  for (const u of (data ?? []) as any[]) m[u.id] = u.nick ? `@${u.nick}` : u.first_name || "Пользователь";
  return m;
}
const pub = (c: Ch) => ({ id: c.id, slug: c.slug, name: c.name, descr: c.descr, photo: c.photo_url, kind: c.kind, subs: c.subs_count, frozen: c.frozen, pinned: c.pinned_post_id });

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const rl = await rateLimit(req, "channels/" + (["comment_add", "react", "view"].includes(action) ? action : "api"), action === "view" ? 300 : 120, 60, uid);
  if (rl) return rl;
  const fl = await userFlags(uid);
  if (fl.teen) return bad("teen_blocked", 403);

  // ---------- создание / правка канала ----------
  if (action === "create") {
    const rl2 = await rateLimit(req, "channels/create", 5, 3600, uid);
    if (rl2) return rl2;
    const name = String(b.name ?? "").trim().slice(0, 60);
    const slug = cleanSlug(b.slug);
    const descr = String(b.descr ?? "").trim().slice(0, 500);
    const kind = ["open", "closed", "hidden"].includes(b.kind) ? b.kind : "open";
    if (name.length < 2) return bad("bad_name");
    if (!slugOk(slug)) return bad("bad_slug");
    if (hasBadWords(name + " " + descr)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
    if (kind !== "hidden") {
      const { count: kc } = await supabaseAdmin.from("channels").select("id", { count: "exact", head: true }).eq("owner_id", uid).eq("kind", kind);
      if ((kc ?? 0) >= 1) return bad("kind_limit", 409);
    }
    if (fl.isNew) {
      const { count } = await supabaseAdmin.from("channels").select("id", { count: "exact", head: true }).eq("owner_id", uid);
      if ((count ?? 0) >= 1) return bad("new_account_limit", 429);
    }
    let photo: string | null = null;
    if (b.photo) {
      if (!(await ownFile(String(b.photo), uid, "participant-photos"))) return bad("bad_file");
      if (!(await verifyStoredFile(String(b.photo), "image"))) return bad("bad_file");
      const n = await checkImageNsfw(String(b.photo));
      if (n?.flag) { await removeFile(String(b.photo)); return bad("nsfw"); }
      photo = String(b.photo);
    }
    const { data, error } = await supabaseAdmin.from("channels").insert({ owner_id: uid, slug, name, descr, kind, photo_url: photo }).select("*").maybeSingle();
    if (error) return bad(String(error.message).includes("duplicate") ? "slug_taken" : "failed", String(error.message).includes("duplicate") ? 409 : 500);
    return ok({ channel: pub(data as Ch) });
  }

  if (action === "slug_check") {
    const s = cleanSlug(b.slug);
    if (!slugOk(s)) return ok({ available: false });
    const { data } = await supabaseAdmin.from("channels").select("id").eq("slug", s).maybeSingle();
    return ok({ available: !data || data.id === b.id });
  }

  if (action === "update") {
    const ch = await getChannel(String(b.id));
    if (!ch || ch.owner_id !== uid) return bad("not_found", 404);
    if (ch.frozen) return bad("frozen", 403);
    const patch: any = {};
    if (typeof b.name === "string") { const n = b.name.trim().slice(0, 60); if (n.length < 2) return bad("bad_name"); patch.name = n; }
    if (typeof b.descr === "string") patch.descr = b.descr.trim().slice(0, 500);
    if (["open", "closed", "hidden"].includes(b.kind)) {
      if (b.kind !== ch.kind && b.kind !== "hidden") {
        const { count: kc } = await supabaseAdmin.from("channels").select("id", { count: "exact", head: true }).eq("owner_id", uid).eq("kind", b.kind).neq("id", ch.id);
        if ((kc ?? 0) >= 1) return bad("kind_limit", 409);
      }
      patch.kind = b.kind;
    }
    if (hasBadWords(`${patch.name ?? ""} ${patch.descr ?? ""}`)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
    if (b.photo && b.photo !== ch.photo_url) {
      if (!(await ownFile(String(b.photo), uid, "participant-photos")) || !(await verifyStoredFile(String(b.photo), "image"))) return bad("bad_file");
      const n = await checkImageNsfw(String(b.photo));
      if (n?.flag) { await removeFile(String(b.photo)); return bad("nsfw"); }
      patch.photo_url = String(b.photo);
    }
    await supabaseAdmin.from("channels").update(patch).eq("id", ch.id);
    return ok();
  }

  if (action === "delete_channel") {
    const ch = await getChannel(String(b.id));
    if (!ch || ch.owner_id !== uid) return bad("not_found", 404);
    const { data: ps } = await supabaseAdmin.from("channel_posts").select("id").eq("channel_id", ch.id).limit(5000);
    const pids = (ps ?? []).map((p: any) => p.id);
    if (pids.length) {
      await supabaseAdmin.from("channel_comments").delete().in("post_id", pids);
      await supabaseAdmin.from("channel_reactions").delete().in("post_id", pids);
      await supabaseAdmin.from("channel_views").delete().in("post_id", pids);
    }
    await supabaseAdmin.from("channel_posts").delete().eq("channel_id", ch.id);
    await supabaseAdmin.from("channel_members").delete().eq("channel_id", ch.id);
    await supabaseAdmin.from("channels").delete().eq("id", ch.id);
    return ok();
  }

  // ---------- чтение ----------
  if (action === "get") {
    const ch = await getChannel(String(b.key));
    if (!ch) return bad("not_found", 404);
    const st = ch.owner_id === uid ? "owner" : await memberStatus(ch.id, uid);
    if (ch.kind === "hidden" && !st) return bad("not_found", 404);
    if (st === "banned") return bad("not_found", 404);
    const can = ch.kind === "open" || st === "owner" || st === "member";
    let pending = 0;
    if (st === "owner") {
      const { count } = await supabaseAdmin.from("channel_members").select("user_id", { count: "exact", head: true }).eq("channel_id", ch.id).eq("status", "pending");
      pending = count ?? 0;
    }
    const { data: m } = st === "member" ? await supabaseAdmin.from("channel_members").select("muted").eq("channel_id", ch.id).eq("user_id", uid).maybeSingle() : { data: null };
    return ok({ channel: pub(ch), me: st, canView: can, pending, muted: !!m?.muted });
  }

  if (action === "mine") {
    const { data: own } = await supabaseAdmin.from("channels").select("*").eq("owner_id", uid).order("created_at", { ascending: false }).limit(200);
    const { data: mem } = await supabaseAdmin.from("channel_members").select("channel_id").eq("user_id", uid).eq("status", "member").limit(500);
    const ids = (mem ?? []).map((m: any) => m.channel_id);
    const { data: subs } = ids.length ? await supabaseAdmin.from("channels").select("*").in("id", ids) : { data: [] as any[] };
    const all = [...(own ?? []).map((c: any) => ({ c, mine: true })), ...(subs ?? []).filter((c: any) => c.owner_id !== uid).map((c: any) => ({ c, mine: false }))];
    const out = [];
    for (const { c, mine } of all as any[]) {
      const { data: lp } = await supabaseAdmin.from("channel_posts").select("body, photo_url, video_id, audio_url, created_at").eq("channel_id", c.id).eq("hidden", false).order("created_at", { ascending: false }).limit(1);
      const p: any = lp?.[0];
      out.push({ ...pub(c as Ch), mine, last: p ? (p.body || (p.video_id ? "🎬 Видео" : p.audio_url ? "🎤 Голосовое" : "📷 Фото")) : "", lastAt: p?.created_at ?? c.created_at });
    }
    out.sort((a, b2) => +new Date(b2.lastAt) - +new Date(a.lastAt));
    return ok({ channels: out });
  }

  if (action === "profile_list") {
    const owner = String(b.userId || "");
    if (!owner) return ok({ channels: [] });
    const { data } = await supabaseAdmin.from("channels").select("*").eq("owner_id", owner).in("kind", ["open", "closed"]).eq("frozen", false).order("created_at").limit(20);
    return ok({ channels: ((data ?? []) as Ch[]).map((c) => ({ id: c.id, name: c.name, kind: c.kind, photo: c.photo_url })) });
  }

  // ---------- подписка ----------
  if (action === "subscribe") {
    const ch = await getChannel(String(b.id));
    if (!ch || ch.owner_id === uid) return bad("not_found", 404);
    if (ch.frozen) return bad("frozen", 403);
    const st = await memberStatus(ch.id, uid);
    if (st === "banned") return bad("banned_here", 403);
    if (st === "member") return ok({ me: "member" });
    if (ch.kind === "hidden" && st !== "invited") return bad("not_found", 404);
    const next = ch.kind === "closed" && st !== "invited" ? "pending" : "member";
    await supabaseAdmin.from("channel_members").upsert({ channel_id: ch.id, user_id: uid, status: next, muted: false }, { onConflict: "channel_id,user_id" });
    if (next === "member") await supabaseAdmin.rpc("channel_recount", { p_channel: ch.id });
    else await notify(ch.owner_id, `Новая заявка в канал «${ch.name}»`, `/channels/${ch.id}`, "other");
    return ok({ me: next });
  }
  if (action === "unsubscribe") {
    const ch = await getChannel(String(b.id));
    if (!ch) return bad("not_found", 404);
    const st = await memberStatus(ch.id, uid);
    if (st === "banned") return ok();
    await supabaseAdmin.from("channel_members").delete().eq("channel_id", ch.id).eq("user_id", uid);
    await supabaseAdmin.rpc("channel_recount", { p_channel: ch.id });
    return ok();
  }
  if (action === "mute") {
    await supabaseAdmin.from("channel_members").update({ muted: !!b.muted }).eq("channel_id", String(b.id)).eq("user_id", uid).eq("status", "member");
    return ok();
  }

  // ---------- управление (владелец) ----------
  const ownerActions = ["requests", "decide", "invite", "kick", "ban", "unban", "members", "pin", "post_create", "video_start"];
  let own: Ch | null = null;
  if (ownerActions.includes(action)) {
    own = await getChannel(String(b.id));
    if (!own || own.owner_id !== uid) return bad("not_found", 404);
    if (own.frozen && action !== "requests" && action !== "members") return bad("frozen", 403);
  }

  if (action === "requests" || action === "members") {
    const status = action === "requests" ? "pending" : b.banned ? "banned" : "member";
    const { data } = await supabaseAdmin.from("channel_members").select("user_id, created_at").eq("channel_id", own!.id).eq("status", status).order("created_at", { ascending: false }).limit(300);
    const names = await authorNames((data ?? []).map((m: any) => m.user_id));
    return ok({ users: (data ?? []).map((m: any) => ({ id: m.user_id, name: names[m.user_id] || "Пользователь", at: m.created_at })) });
  }
  if (action === "decide") {
    const target = String(b.userId || "");
    const st = await memberStatus(own!.id, target);
    if (st !== "pending") return bad("not_found", 404);
    if (b.accept) {
      await supabaseAdmin.from("channel_members").update({ status: "member" }).eq("channel_id", own!.id).eq("user_id", target);
      await supabaseAdmin.rpc("channel_recount", { p_channel: own!.id });
      await notify(target, `Вашу заявку в канал «${own!.name}» приняли`, `/channels/${own!.id}`, "other");
    } else {
      await supabaseAdmin.from("channel_members").delete().eq("channel_id", own!.id).eq("user_id", target);
    }
    return ok();
  }
  if (action === "invite") {
    const nick = String(b.nick || "").trim().replace(/^@/, "").toLowerCase();
    if (!nick) return bad("bad_request");
    const { data: u } = await supabaseAdmin.from("users").select("id, age_category, is_banned").ilike("nick", nick).maybeSingle();
    if (!u || u.is_banned || (u as any).age_category === "teen" || u.id === uid) return bad("no_user", 404);
    const st = await memberStatus(own!.id, u.id as string);
    if (st === "banned") return bad("banned_here", 403);
    if (st === "member") return ok({ already: true });
    await supabaseAdmin.from("channel_members").upsert({ channel_id: own!.id, user_id: u.id, status: "invited" }, { onConflict: "channel_id,user_id" });
    await notify(u.id as string, `Вас приглашают в канал «${own!.name}»`, `/channels/${own!.id}`, "other");
    return ok();
  }
  if (action === "kick" || action === "ban" || action === "unban") {
    const target = String(b.userId || "");
    if (!target || target === uid) return bad("bad_request");
    if (action === "ban") await supabaseAdmin.from("channel_members").upsert({ channel_id: own!.id, user_id: target, status: "banned" }, { onConflict: "channel_id,user_id" });
    else await supabaseAdmin.from("channel_members").delete().eq("channel_id", own!.id).eq("user_id", target);
    if (action !== "unban") await supabaseAdmin.from("channel_comments").update({ hidden: true }).eq("channel_id", own!.id).eq("user_id", target);
    await supabaseAdmin.rpc("channel_recount", { p_channel: own!.id });
    return ok();
  }
  if (action === "pin") {
    const pid = b.postId ? String(b.postId) : null;
    if (pid) {
      const { data: p } = await supabaseAdmin.from("channel_posts").select("id").eq("id", pid).eq("channel_id", own!.id).maybeSingle();
      if (!p) return bad("not_found", 404);
    }
    await supabaseAdmin.from("channels").update({ pinned_post_id: pid }).eq("id", own!.id);
    return ok();
  }

  // ---------- видео (Bunny) ----------
  if (action === "video_start") {
    const rl2 = await rateLimit(req, "channels/video", 10, 600, uid);
    if (rl2) return rl2;
    const cfg = bunnyCfg();
    if (!cfg) return ok({ configured: false });
    const guid = await bunnyCreateVideo(`vetoks-ch-${own!.id}-${Date.now()}`);
    if (!guid) return bad("bunny_failed", 502);
    await supabaseAdmin.from("channel_video_uploads").insert({ video_id: guid, user_id: uid, channel_id: own!.id });
    const expire = Math.floor(Date.now() / 1000) + 3600;
    return ok({ configured: true, videoId: guid, libraryId: cfg.lib, expire, signature: bunnySignature(guid, expire) });
  }

  // ---------- посты ----------
  if (action === "post_create") {
    const ch = own!;
    const body = String(b.body ?? "").trim().slice(0, 4000);
    const photo = b.photo ? String(b.photo) : "";
    const audio = b.audio ? String(b.audio) : "";
    const audioSec = Math.min(180, Math.max(0, Math.round(Number(b.audioSec) || 0)));
    const videoId = b.videoId ? String(b.videoId) : "";
    if (!body && !photo && !audio && !videoId) return bad("empty");
    if (hasBadWords(body)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
    const since = new Date(Date.now() - 86400_000).toISOString();
    const { count: today } = await supabaseAdmin.from("channel_posts").select("id", { count: "exact", head: true }).eq("channel_id", ch.id).gte("created_at", since);
    if ((today ?? 0) >= (fl.isNew ? 3 : 50)) return bad("posts_limit", 429);
    const rec: any = { channel_id: ch.id, body };
    if (photo) {
      if (!(await ownFile(photo, uid, "participant-photos")) || !(await verifyStoredFile(photo, "image"))) return bad("bad_file");
      const n = await checkImageNsfw(photo);
      if (n?.flag) { await removeFile(photo); return bad("nsfw"); }
      rec.photo_url = photo;
    }
    if (audio) {
      if (!(await ownFile(audio, uid, "channel-audio"))) return bad("bad_file");
      let size = 0;
      try { const h = await fetch(audio, { method: "HEAD" }); size = Number(h.headers.get("content-length") || 0); } catch {}
      if (size > AUDIO_MAX) { await removeFile(audio); return bad("audio_too_big"); }
      rec.audio_url = audio;
      rec.audio_sec = audioSec;
    }
    if (videoId) {
      const { data: up } = await supabaseAdmin.from("channel_video_uploads").select("*").eq("video_id", videoId).maybeSingle();
      if (!up || up.user_id !== uid || up.channel_id !== ch.id) return bad("not_yours", 403);
      if (up.used) return bad("already_used");
      const info = await bunnyGetVideo(videoId);
      if (!info) return bad("bunny_failed", 502);
      const len = Number(info.length ?? 0);
      if (len > 61) {
        await bunnyDeleteVideo(videoId);
        await supabaseAdmin.from("channel_video_uploads").update({ used: true }).eq("video_id", videoId);
        return bad("too_long");
      }
      rec.video_id = videoId;
      rec.video_url = bunnyPlayUrl(videoId);
      rec.duration_sec = len > 0 ? Math.round(len) : null;
      await supabaseAdmin.from("channel_video_uploads").update({ used: true }).eq("video_id", videoId);
    }
    const { data: post, error } = await supabaseAdmin.from("channel_posts").insert(rec).select("id").maybeSingle();
    if (error || !post) return bad("failed", 500);
    await fanoutPost(ch, post.id as string, body, uid);
    return ok({ id: post.id });
  }

  if (action === "post_edit" || action === "post_delete") {
    const { data: p } = await supabaseAdmin.from("channel_posts").select("id, channel_id, photo_url, audio_url, video_id").eq("id", String(b.postId)).maybeSingle();
    if (!p) return bad("not_found", 404);
    const ch = await getChannel(p.channel_id as string);
    if (!ch || ch.owner_id !== uid) return bad("not_found", 404);
    if (action === "post_edit") {
      const body = String(b.body ?? "").trim().slice(0, 4000);
      if (hasBadWords(body)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
      if (!body && !p.photo_url && !p.audio_url && !p.video_id) return bad("empty");
      await supabaseAdmin.from("channel_posts").update({ body, edited_at: new Date().toISOString() }).eq("id", p.id);
    } else {
      await supabaseAdmin.from("channel_comments").delete().eq("post_id", p.id);
      await supabaseAdmin.from("channel_reactions").delete().eq("post_id", p.id);
      await supabaseAdmin.from("channel_views").delete().eq("post_id", p.id);
      await supabaseAdmin.from("channel_posts").delete().eq("id", p.id);
      if (ch.pinned_post_id === p.id) await supabaseAdmin.from("channels").update({ pinned_post_id: null }).eq("id", ch.id);
      if (p.photo_url) await removeFile(p.photo_url as string);
      if (p.audio_url) await removeFile(p.audio_url as string);
      if (p.video_id) await bunnyDeleteVideo(p.video_id as string);
    }
    return ok();
  }

  // ---------- действия над постом: нужен доступ к каналу ----------
  const postActions = ["posts", "view", "react", "comments", "comment_add", "report"];
  if (postActions.includes(action) || action === "comment_edit" || action === "comment_delete") {
    let ch: Ch | null = null;
    let postId = String(b.postId || "");
    let commentRow: any = null;
    if (action === "comment_edit" || action === "comment_delete") {
      const { data } = await supabaseAdmin.from("channel_comments").select("*").eq("id", String(b.commentId)).maybeSingle();
      if (!data) return bad("not_found", 404);
      commentRow = data;
      ch = await getChannel(data.channel_id as string);
    } else if (action === "posts") {
      ch = await getChannel(String(b.id));
    } else {
      const { data: p } = await supabaseAdmin.from("channel_posts").select("channel_id, hidden").eq("id", postId).maybeSingle();
      if (!p || p.hidden) return bad("not_found", 404);
      ch = await getChannel(p.channel_id as string);
    }
    if (!ch) return bad("not_found", 404);
    const st = ch.owner_id === uid ? "owner" : await memberStatus(ch.id, uid);
    if (st === "banned" || (ch.kind === "hidden" && !st)) return bad("not_found", 404);
    const canView = ch.kind === "open" || st === "owner" || st === "member";
    if (!canView) return bad("closed", 403);

    if (action === "posts") {
      const before = b.before ? new Date(String(b.before)).toISOString() : null;
      let q = supabaseAdmin.from("channel_posts").select("*").eq("channel_id", ch.id).eq("hidden", false).order("created_at", { ascending: false }).limit(15);
      if (before) q = q.lt("created_at", before);
      const { data: ps } = await q;
      let list: any[] = ps ?? [];
      if (!before && ch.pinned_post_id && !list.find((x) => x.id === ch.pinned_post_id)) {
        const { data: pp } = await supabaseAdmin.from("channel_posts").select("*").eq("id", ch.pinned_post_id).eq("hidden", false).maybeSingle();
        if (pp) list = [pp, ...list];
      }
      const ids = list.map((p) => p.id);
      const { data: rs } = ids.length ? await supabaseAdmin.from("channel_reactions").select("post_id, user_id, emoji").in("post_id", ids).limit(20000) : { data: [] as any[] };
      const { data: cs } = ids.length ? await supabaseAdmin.from("channel_comments").select("post_id").in("post_id", ids).eq("hidden", false).limit(20000) : { data: [] as any[] };
      const out = list.map((p) => {
        const reactions: Record<string, number> = {};
        let mine = "";
        for (const r of (rs ?? []) as any[]) if (r.post_id === p.id) { reactions[r.emoji] = (reactions[r.emoji] || 0) + 1; if (r.user_id === uid) mine = r.emoji; }
        return {
          id: p.id, body: p.body, photo: p.photo_url, video: p.video_url, audio: p.audio_url, audioSec: p.audio_sec,
          views: p.views, at: p.created_at, edited: !!p.edited_at, reactions, mine,
          comments: ((cs ?? []) as any[]).filter((c) => c.post_id === p.id).length, pinned: ch!.pinned_post_id === p.id,
        };
      });
      return ok({ posts: out, more: (ps ?? []).length >= 15 });
    }
    if (action === "view") {
      if (st !== "owner") await supabaseAdmin.rpc("channel_view_hit", { p_post: postId, p_user: uid });
      return ok();
    }
    if (action === "react") {
      const emoji = String(b.emoji || "");
      if (!EMOJIS.includes(emoji) && emoji !== "") return bad("bad_request");
      if (ch.frozen) return bad("frozen", 403);
      if (!emoji) await supabaseAdmin.from("channel_reactions").delete().eq("post_id", postId).eq("user_id", uid);
      else await supabaseAdmin.from("channel_reactions").upsert({ post_id: postId, user_id: uid, emoji }, { onConflict: "post_id,user_id" });
      return ok();
    }
    if (action === "comments") {
      const { data } = await supabaseAdmin.from("channel_comments").select("id, user_id, body, created_at, edited_at").eq("post_id", postId).eq("hidden", false).order("created_at").limit(300);
      const names = await authorNames(Array.from(new Set((data ?? []).map((c: any) => c.user_id))));
      return ok({
        comments: (data ?? []).map((c: any) => ({ id: c.id, userId: c.user_id, name: names[c.user_id] || "Пользователь", body: c.body, at: c.created_at, edited: !!c.edited_at })),
        canWrite: st === "owner" || st === "member",
      });
    }
    if (action === "comment_add") {
      if (!(st === "owner" || st === "member")) return bad("need_subscribe", 403);
      if (ch.frozen) return bad("frozen", 403);
      const text = String(b.body ?? "").trim().slice(0, 1000);
      if (!text) return bad("empty");
      if (LINK_RE.test(text)) return bad("no_links", 400);
      if (hasBadWords(text)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
      const rl2 = await rateLimit(req, "channels/comment", fl.isNew ? 5 : 15, 60, uid);
      if (rl2) return rl2;
      if (fl.isNew) {
        const { count } = await supabaseAdmin.from("channel_comments").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", new Date(Date.now() - 86400_000).toISOString());
        if ((count ?? 0) >= 30) return bad("new_account_limit", 429);
      }
      const { data, error } = await supabaseAdmin.from("channel_comments").insert({ post_id: postId, channel_id: ch.id, user_id: uid, body: text }).select("id").maybeSingle();
      if (error) return bad("failed", 500);
      return ok({ id: data?.id });
    }
    if (action === "comment_edit" || action === "comment_delete") {
      const mineC = commentRow.user_id === uid;
      if (action === "comment_edit") {
        if (!mineC) return bad("not_yours", 403);
        const text = String(b.body ?? "").trim().slice(0, 1000);
        if (!text) return bad("empty");
        if (LINK_RE.test(text)) return bad("no_links", 400);
        if (hasBadWords(text)) return bad("bad_words", 400, { message: BAD_WORDS_MESSAGE });
        await supabaseAdmin.from("channel_comments").update({ body: text, edited_at: new Date().toISOString() }).eq("id", commentRow.id);
      } else {
        if (!mineC && st !== "owner") return bad("not_yours", 403);
        await supabaseAdmin.from("channel_comments").delete().eq("id", commentRow.id);
      }
      return ok();
    }
    if (action === "report") {
      const reason = REASONS.includes(b.reason) ? b.reason : "other";
      const rl2 = await rateLimit(req, "channels/report", 15, 3600, uid);
      if (rl2) return rl2;
      const { error } = await supabaseAdmin.from("channel_reports").insert({
        channel_id: ch.id, post_id: postId || null, comment_id: b.commentId ? String(b.commentId) : null,
        reporter_id: uid, reason, details: String(b.details ?? "").slice(0, 500),
      });
      if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);
      await notify(ch.owner_id, `Жалоба в вашем канале «${ch.name}»`, `/channels/${ch.id}`, "other");
      return ok();
    }
  }

  // жалоба на канал целиком
  if (action === "report_channel") {
    const ch = await getChannel(String(b.id));
    if (!ch) return bad("not_found", 404);
    const reason = REASONS.includes(b.reason) ? b.reason : "other";
    const { error } = await supabaseAdmin.from("channel_reports").insert({ channel_id: ch.id, reporter_id: uid, reason, details: String(b.details ?? "").slice(0, 500) });
    if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);
    return ok();
  }

  return bad("unknown_action");
}
