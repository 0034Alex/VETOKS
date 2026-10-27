"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { cleanImage } from "@/lib/imageClean";
import { bunnyUpload, videoDuration } from "@/lib/bunnyUpload";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";

type Ch = { id: string; slug: string; name: string; descr: string; photo: string | null; kind: "open" | "closed" | "hidden"; subs: number; frozen: boolean; pinned: string | null };
type Post = { id: string; body: string; photo: string | null; video: string | null; audio: string | null; audioSec: number | null; views: number; at: string; edited: boolean; reactions: Record<string, number>; mine: string; comments: number; pinned: boolean };
type Cm = { id: string; userId: string; name: string; body: string; at: string; edited: boolean };

const EMOJIS = ["❤️", "🔥", "👍", "😍", "😂", "👏"];
const REASONS: [string, string][] = [["spam", "Спам"], ["nudity", "Откровенный контент"], ["violence", "Насилие"], ["hate", "Оскорбления"], ["scam", "Мошенничество"], ["minor", "Несовершеннолетние"], ["illegal", "Незаконное"], ["other", "Другое"]];
const ERR: Record<string, string> = {
  frozen: "Канал заморожен модерацией.", no_links: "В комментариях ссылки запрещены.", bad_words: "В тексте есть недопустимые слова.",
  nsfw: "Фото не прошло проверку.", too_long: "Видео длиннее 60 секунд.", audio_too_big: "Голосовое больше 5 МБ.", posts_limit: "Достигнут лимит постов на сутки.",
  rate_limited: "Слишком часто. Подождите немного.", new_account_limit: "Лимит для нового аккаунта. Попробуйте позже.", need_subscribe: "Писать могут только подписчики.",
  bad_file: "Не удалось принять файл.", edit_expired: "Изменять можно только в течение 6 часов после публикации.", empty: "Пустое сообщение.",
};
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const editable = (iso: string) => Date.now() - new Date(iso).getTime() < 6 * 3600_000;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function ChannelView({ keyStr }: { keyStr: string }) {
  const router = useRouter();
  const [ch, setCh] = useState<Ch | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [canView, setCanView] = useState(false);
  const [pending, setPending] = useState(0);
  const [muted, setMuted] = useState(false);
  const [uid, setUid] = useState("");
  const [state, setState] = useState<"load" | "ok" | "none">("load");
  const [posts, setPosts] = useState<Post[]>([]);
  const [more, setMore] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<"" | "requests" | "members" | "invite">("");
  const [cmPost, setCmPost] = useState<Post | null>(null);
  const [repTarget, setRepTarget] = useState<{ postId?: string; commentId?: string; channel?: boolean } | null>(null);
  const [menuPost, setMenuPost] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (posts.length && !scrolled.current) { scrolled.current = true; setTimeout(() => bottom.current?.scrollIntoView(), 150); }
  }, [posts]);

  const loadPosts = useCallback(async (id: string, before?: string) => {
    const r = await apiPost("/api/channels", { action: "posts", id, before });
    if (r?.ok) {
      setPosts((p) => (before ? [...p, ...r.posts.filter((x: Post) => !p.find((y) => y.id === x.id))] : r.posts));
      setMore(!!r.more);
    }
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { router.push(`/login?redirect=/channels/${keyStr}`); return; }
    setUid(data.session.user.id);
    const r = await apiPost("/api/channels", { action: "get", key: keyStr });
    if (!r?.ok) { setState("none"); return; }
    setCh(r.channel); setMe(r.me); setCanView(r.canView); setPending(r.pending ?? 0); setMuted(!!r.muted);
    setState("ok");
    if (r.canView) await loadPosts(r.channel.id);
  }, [keyStr, router, loadPosts]);

  useEffect(() => { load(); }, [load]);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };
  const fail = (r: any) => flash(r?.message || ERR[r?.error] || "Не получилось. Попробуйте ещё раз.");

  async function subscribe() {
    const r = await apiPost("/api/channels", { action: "subscribe", id: ch!.id });
    if (!r?.ok) return fail(r);
    if (r.me === "pending") flash("Заявка отправлена. Владелец канала её рассмотрит.");
    await load();
  }
  async function unsubscribe() {
    await apiPost("/api/channels", { action: "unsubscribe", id: ch!.id });
    setPosts([]);
    await load();
  }
  async function toggleMute() {
    const v = !muted;
    setMuted(v);
    await apiPost("/api/channels", { action: "mute", id: ch!.id, muted: v });
  }
  async function copyLink() {
    const url = `https://vetoks.com/c/${ch!.slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { flash(url); }
  }

  if (state === "load") return <main className="min-h-screen" />;
  if (state === "none" || !ch) {
    return (
      <main className="min-h-screen pb-24"><PageHeader />
        <p className="text-muted text-center px-6 mt-10">Канал не найден или недоступен.</p>
        <BottomNav />
      </main>
    );
  }
  const isOwner = me === "owner";
  const isMember = me === "member";
  const kindLabel = ch.kind === "open" ? "Открытый канал" : ch.kind === "closed" ? "🔒 Закрытый канал" : "Скрытый канал";

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-xl mx-auto px-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sec to-sec2 bg-cover bg-center flex items-center justify-center text-white text-2xl font-semibold flex-shrink-0" style={ch.photo ? { backgroundImage: `url(${ch.photo})` } : undefined}>
            {!ch.photo && ch.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-offwhite text-xl font-semibold break-words">{ch.name}</h1>
            <p className="text-muted text-xs">{kindLabel} · {ch.subs} подписчиков</p>
          </div>
        </div>
        {ch.descr && <p className="text-offwhite text-sm mt-3 whitespace-pre-line">{ch.descr}</p>}
        <button onClick={copyLink} className="mt-2 text-xs text-gold">{copied ? "Ссылка скопирована" : `vetoks.com/c/${ch.slug}`}</button>
        {ch.frozen && <p className="mt-3 text-danger text-sm">Канал заморожен модерацией.</p>}

        <div className="flex flex-wrap gap-2 mt-4">
          {isOwner ? (
            <>
              <Link href={`/channels/${ch.id}/edit`} className="rounded-full border border-muted px-4 py-2 text-sm text-offwhite">Настройки</Link>
              {ch.kind === "closed" && <button onClick={() => setPanel("requests")} className="rounded-full border border-muted px-4 py-2 text-sm text-offwhite">Запросы{pending > 0 ? ` (${pending})` : ""}</button>}
              <button onClick={() => setPanel("members")} className="rounded-full border border-muted px-4 py-2 text-sm text-offwhite">Подписчики</button>
              {ch.kind !== "open" && <button onClick={() => setPanel("invite")} className="rounded-full border border-muted px-4 py-2 text-sm text-offwhite">Пригласить</button>}
            </>
          ) : isMember ? (
            <>
              <button onClick={unsubscribe} className="rounded-full border border-muted px-4 py-2 text-sm text-offwhite">Вы подписаны ✓</button>
              <button onClick={toggleMute} className="rounded-full border border-muted px-4 py-2 text-sm text-offwhite">{muted ? "🔕 Без звука" : "🔔 Уведомления"}</button>
            </>
          ) : me === "pending" ? (
            <span className="rounded-full border border-muted px-4 py-2 text-sm text-muted">Заявка отправлена</span>
          ) : (
            <button onClick={subscribe} className="rounded-full bg-gold text-black font-semibold px-5 py-2 text-sm">
              {me === "invited" ? "Принять приглашение" : ch.kind === "closed" ? "Подать заявку" : "Подписаться"}
            </button>
          )}
          {!isOwner && <button onClick={() => setRepTarget({ channel: true })} className="rounded-full border border-muted px-4 py-2 text-sm text-muted">Пожаловаться</button>}
        </div>
        {msg && <p className="mt-3 text-sm text-goldSoft">{msg}</p>}

        {!canView ? (
          <p className="text-muted text-center mt-10 text-sm">Посты этого канала видят только подписчики.</p>
        ) : posts.length === 0 ? (
          <p className="text-muted text-center mt-10 text-sm">Пока нет постов.</p>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {more && <button onClick={() => loadPosts(ch.id, posts.filter((x) => !x.pinned).reduce((a, x) => (new Date(x.at) < new Date(a) ? x.at : a), new Date().toISOString()))} className="text-gold text-sm py-2">Показать ещё</button>}
            {[...(posts.find((x) => x.pinned) ? [posts.find((x) => x.pinned)!] : []), ...posts.filter((x) => !x.pinned).slice().reverse()].map((p) => (
              <PostCard key={p.id} p={p} isOwner={isOwner} uid={uid} menuOpen={menuPost === p.id} setMenu={(o) => setMenuPost(o ? p.id : null)}
                onReact={async (emoji) => {
                  const e = p.mine === emoji ? "" : emoji;
                  setPosts((l) => l.map((x) => {
                    if (x.id !== p.id) return x;
                    const rr = { ...x.reactions };
                    if (x.mine) rr[x.mine] = Math.max(0, (rr[x.mine] || 1) - 1);
                    if (e) rr[e] = (rr[e] || 0) + 1;
                    return { ...x, reactions: rr, mine: e };
                  }));
                  const r = await apiPost("/api/channels", { action: "react", postId: p.id, emoji: e });
                  if (!r?.ok) fail(r);
                }}
                onComments={() => setCmPost(p)}
                onReport={() => setRepTarget({ postId: p.id })}
                onPin={async () => { await apiPost("/api/channels", { action: "pin", id: ch.id, postId: p.pinned ? null : p.id }); setMenuPost(null); await load(); }}
                onEdit={async () => {
                  const t = window.prompt("Изменить текст поста", p.body);
                  setMenuPost(null);
                  if (t === null) return;
                  const r = await apiPost("/api/channels", { action: "post_edit", postId: p.id, body: t });
                  if (!r?.ok) return fail(r);
                  await loadPosts(ch.id);
                }}
                onDelete={async () => {
                  setMenuPost(null);
                  if (!window.confirm("Удалить пост?")) return;
                  await apiPost("/api/channels", { action: "post_delete", postId: p.id });
                  await loadPosts(ch.id);
                }}
              />
            ))}
          </div>
        )}
        {isOwner && !ch.frozen && <Composer chId={ch.id} onDone={() => { loadPosts(ch.id); setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 500); }} onErr={fail} />}
        <div ref={bottom} />
      </div>
      {panel && <PeoplePanel ch={ch} kind={panel} onClose={() => { setPanel(""); load(); }} onErr={fail} />}
      {cmPost && <Comments post={cmPost} chId={ch.id} isOwner={isOwner} uid={uid} me={me} onClose={() => { setCmPost(null); loadPosts(ch.id); }} onSubscribed={load} onReport={(id) => setRepTarget({ postId: cmPost.id, commentId: id })} onErr={fail} />}
      {repTarget && <ReportSheet target={repTarget} chId={ch.id} onClose={(sent) => { setRepTarget(null); if (sent) flash("Жалоба отправлена."); }} />}
      <BottomNav />
    </main>
  );
}

function PostCard(props: { p: Post; isOwner: boolean; uid: string; menuOpen: boolean; setMenu: (o: boolean) => void; onReact: (e: string) => void; onComments: () => void; onReport: () => void; onPin: () => void; onEdit: () => void; onDelete: () => void }) {
  const { p, isOwner } = props;
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !seen.current) { seen.current = true; apiPost("/api/channels", { action: "view", postId: p.id }); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [p.id]);
  return (
    <div ref={ref} className="bg-bgSurface border border-muted rounded-2xl overflow-hidden">
      {p.pinned && <p className="px-4 pt-3 text-[11px] text-gold">📌 Закреплено</p>}
      {p.photo && <img src={p.photo} alt="" className="w-full max-h-[480px] object-cover" loading="lazy" />}
      {p.video && <video src={p.video} controls playsInline preload="metadata" className="w-full max-h-[520px] bg-black" />}
      {p.audio && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <span className="text-lg">🎤</span>
          <audio src={p.audio} controls preload="none" className="flex-1 h-9" />
          {!!p.audioSec && <span className="text-muted text-xs">{mmss(p.audioSec)}</span>}
        </div>
      )}
      {p.body && <p className="px-4 pt-3 text-offwhite text-sm whitespace-pre-line break-words">{p.body}</p>}
      <div className="px-4 pt-3 flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => props.onReact(e)} className={`rounded-full px-2.5 py-1 text-sm border ${p.mine === e ? "border-gold bg-black/30" : "border-muted"}`}>
            {e}{(p.reactions[e] || 0) > 0 && <span className="ml-1 text-xs text-offwhite">{p.reactions[e]}</span>}
          </button>
        ))}
      </div>
      <div className="px-4 py-3 flex items-center justify-between text-xs text-muted">
        <span>{when(p.at)}{p.edited ? " · изменено" : ""} · 👁 {p.views}</span>
        <div className="flex items-center gap-3">
          {isOwner && <button onClick={props.onPin} className={p.pinned ? "text-gold" : "text-muted"} aria-label="Закрепить">📌 {p.pinned ? "Закреплён" : "Закрепить"}</button>}
          <button onClick={props.onComments} className="text-offwhite">💬 {p.comments}</button>
          <div className="relative">
            <button onClick={() => props.setMenu(!props.menuOpen)} aria-label="Меню" className="px-1 text-base">⋯</button>
            {props.menuOpen && (
              <div className="absolute right-0 bottom-7 z-20 bg-bgSurface border border-muted rounded-xl py-1 w-44 text-sm text-offwhite shadow-xl">
                {isOwner ? (
                  <>
                    <button className="w-full text-left px-3 py-2" onClick={props.onPin}>{p.pinned ? "Открепить" : "Закрепить"}</button>
                    {editable(p.at) && <button className="w-full text-left px-3 py-2" onClick={props.onEdit}>Изменить текст</button>}
                    <button className="w-full text-left px-3 py-2 text-danger" onClick={props.onDelete}>Удалить</button>
                  </>
                ) : (
                  <button className="w-full text-left px-3 py-2" onClick={() => { props.setMenu(false); props.onReport(); }}>Пожаловаться</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer({ chId, onDone, onErr }: { chId: string; onDone: () => void; onErr: (r: any) => void }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [video, setVideo] = useState<{ id: string; name: string } | null>(null);
  const [audio, setAudio] = useState<{ url: string; sec: number } | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const pf = useRef<HTMLInputElement>(null);
  const vf = useRef<HTMLInputElement>(null);

  async function uid() { return (await supabase.auth.getSession()).data.session?.user.id || ""; }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    setPct(0);
    try {
      const fc = await cleanImage(f);
      const path = `${await uid()}-${Date.now()}-chp.${(fc.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, fc);
      if (error) throw error;
      setPhoto(supabase.storage.from("participant-photos").getPublicUrl(path).data.publicUrl);
    } catch { onErr({ error: "bad_file" }); }
    setPct(null);
  }
  async function pickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !f.type.startsWith("video/")) return;
    const d = await videoDuration(f);
    if (d > 60.5) return onErr({ error: "too_long" });
    setPct(0);
    const up = await apiPost("/api/channels", { action: "video_start", id: chId });
    if (!up?.ok || !up.configured) { setPct(null); return onErr({ message: "Видео временно недоступно." }); }
    try {
      await bunnyUpload(f, up, (p) => setPct(Math.min(99, p)));
      setVideo({ id: up.videoId, name: f.name });
    } catch (x: any) { onErr({ message: x?.message || "Ошибка загрузки видео" }); }
    setPct(null);
  }
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";
      const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = r.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type: mime });
        const len = Math.min(180, Math.round((Date.now() - startedAt) / 1000));
        if (blob.size > 5 * 1024 * 1024) return onErr({ error: "audio_too_big" });
        if (len < 1) return;
        setPct(0);
        const ext = mime.includes("mp4") ? "m4a" : "webm";
        const path = `${await uid()}-${Date.now()}-v.${ext}`;
        const { error } = await supabase.storage.from("channel-audio").upload(path, blob, { contentType: mime });
        setPct(null);
        if (error) return onErr({ message: "Не удалось загрузить голосовое." });
        setAudio({ url: supabase.storage.from("channel-audio").getPublicUrl(path).data.publicUrl, sec: len });
      };
      const startedAt = Date.now();
      r.start();
      mr.current = r; setRec(true); setSec(0);
      timer.current = setInterval(() => setSec((s) => { if (s + 1 >= 180) stopRec(); return s + 1; }), 1000);
    } catch { onErr({ message: "Нет доступа к микрофону." }); }
  }
  function stopRec() {
    if (timer.current) clearInterval(timer.current);
    setRec(false);
    if (mr.current && mr.current.state !== "inactive") mr.current.stop();
  }
  async function publish() {
    setBusy(true);
    const r = await apiPost("/api/channels", { action: "post_create", id: chId, body: text, photo, videoId: video?.id, audio: audio?.url, audioSec: audio?.sec });
    setBusy(false);
    if (!r?.ok) return onErr(r);
    setText(""); setPhoto(null); setVideo(null); setAudio(null);
    onDone();
  }
  const has = text.trim() || photo || video || audio;
  return (
    <div className="mt-5 bg-bgSurface border border-muted rounded-2xl p-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Новый пост…" className="w-full bg-transparent outline-none text-offwhite text-sm resize-none" />
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        {photo && <img src={photo} alt="" className="h-14 rounded-lg" />}
        {video && <span className="border border-muted rounded-lg px-2 py-1">🎬 {video.name}</span>}
        {audio && <span className="border border-muted rounded-lg px-2 py-1">🎤 {mmss(audio.sec)}</span>}
        {pct !== null && <span>Загрузка {pct}%…</span>}
        {rec && <span className="text-danger">● Запись {mmss(sec)} / 3:00</span>}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={() => pf.current?.click()} className="rounded-full border border-muted px-3 py-1.5 text-sm" aria-label="Фото">📷</button>
        <button type="button" onClick={() => vf.current?.click()} className="rounded-full border border-muted px-3 py-1.5 text-sm" aria-label="Видео">🎬</button>
        <button type="button" onClick={rec ? stopRec : startRec} className={`rounded-full border px-3 py-1.5 text-sm ${rec ? "border-danger text-danger" : "border-muted"}`} aria-label="Голосовое">{rec ? "⏹" : "🎤"}</button>
        <input ref={pf} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <input ref={vf} type="file" accept="video/*" hidden onChange={pickVideo} />
        <button disabled={!has || busy || pct !== null || rec} onClick={publish} className="ml-auto rounded-full bg-gold text-black font-semibold px-5 py-1.5 text-sm disabled:opacity-40">{busy ? "…" : "Опубликовать"}</button>
      </div>
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/65 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5 max-h-[85vh] flex flex-col" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-offwhite font-semibold">{title}</p>
          <button onClick={onClose} className="text-muted text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Comments({ post, chId, isOwner, uid, me, onClose, onSubscribed, onReport, onErr }: { post: Post; chId: string; isOwner: boolean; uid: string; me: string | null; onClose: () => void; onSubscribed: () => void; onReport: (id: string) => void; onErr: (r: any) => void }) {
  const [list, setList] = useState<Cm[]>([]);
  const [canWrite, setCanWrite] = useState(isOwner || me === "member");
  const [text, setText] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [sentReq, setSentReq] = useState(false);
  const load = useCallback(async () => {
    const r = await apiPost("/api/channels", { action: "comments", postId: post.id });
    if (r?.ok) { setList(r.comments); setCanWrite(r.canWrite); }
  }, [post.id]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    const r = edit
      ? await apiPost("/api/channels", { action: "comment_edit", commentId: edit, body })
      : await apiPost("/api/channels", { action: "comment_add", postId: post.id, body });
    if (!r?.ok) return onErr(r);
    setText(""); setEdit(null); load();
  }
  async function sub() {
    const r = await apiPost("/api/channels", { action: "subscribe", id: chId });
    if (!r?.ok) return onErr(r);
    if (r.me === "member") { setCanWrite(true); onSubscribed(); } else setSentReq(true);
  }
  return (
    <Sheet title={`Комментарии · ${list.length}`} onClose={onClose}>
      <div className="overflow-y-auto overscroll-contain flex-1 flex flex-col gap-3 pb-3 min-h-[120px]">
        {list.length === 0 && <p className="text-muted text-sm text-center mt-4">Пока нет комментариев.</p>}
        {list.map((c) => (
          <div key={c.id} className="text-sm">
            <div className="flex items-center gap-2 text-xs text-muted"><span className="text-offwhite font-semibold">{c.name}</span>{when(c.at)}{c.edited ? " · изм." : ""}</div>
            <p className="text-offwhite break-words whitespace-pre-line">{c.body}</p>
            <div className="flex gap-3 text-[11px] text-muted mt-0.5">
              {c.userId === uid && editable(c.at) && <button onClick={() => { setEdit(c.id); setText(c.body); }}>Изменить</button>}
              {(c.userId === uid || isOwner) && <button onClick={async () => { await apiPost("/api/channels", { action: "comment_delete", commentId: c.id }); load(); }}>Удалить</button>}
              {c.userId !== uid && <button onClick={() => onReport(c.id)}>Пожаловаться</button>}
            </div>
          </div>
        ))}
      </div>
      {canWrite ? (
        <div className="flex gap-2 items-end">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000} placeholder="Комментарий" className="flex-1 bg-black/30 border border-muted rounded-xl px-3 py-2 text-sm text-offwhite outline-none resize-none" />
          <button onClick={send} disabled={!text.trim()} className="rounded-full bg-gold text-black font-semibold px-4 py-2 text-sm disabled:opacity-40">{edit ? "Сохранить" : "Отправить"}</button>
        </div>
      ) : (
        <div className="border border-muted rounded-xl p-3 text-center">
          <p className="text-offwhite text-sm">Писать могут только подписчики</p>
          {sentReq ? <p className="text-muted text-xs mt-2">Заявка отправлена владельцу канала.</p> : <button onClick={sub} className="mt-2 rounded-full bg-gold text-black font-semibold px-5 py-2 text-sm">Подписаться</button>}
        </div>
      )}
    </Sheet>
  );
}

function PeoplePanel({ ch, kind, onClose, onErr }: { ch: Ch; kind: "requests" | "members" | "invite"; onClose: () => void; onErr: (r: any) => void }) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [nick, setNick] = useState("");
  const [info, setInfo] = useState("");
  const [banned, setBanned] = useState(false);
  const load = useCallback(async () => {
    if (kind === "invite") return;
    const r = await apiPost("/api/channels", { action: kind, id: ch.id, banned });
    if (r?.ok) setUsers(r.users);
  }, [kind, ch.id, banned]);
  useEffect(() => { load(); }, [load]);
  const act = async (action: string, userId: string, extra: object = {}) => {
    const r = await apiPost("/api/channels", { action, id: ch.id, userId, ...extra });
    if (!r?.ok) return onErr(r);
    load();
  };
  return (
    <Sheet title={kind === "requests" ? "Запросы на подписку" : kind === "members" ? (banned ? "Заблокированные" : "Подписчики") : "Пригласить"} onClose={onClose}>
      {kind === "invite" ? (
        <div>
          <p className="text-muted text-xs mb-2">Введите ник человека в VETOKS — ему придёт приглашение.</p>
          <div className="flex gap-2">
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="@ник" className="flex-1 bg-black/30 border border-muted rounded-xl px-3 py-2 text-sm text-offwhite outline-none" />
            <button className="rounded-full bg-gold text-black font-semibold px-4 text-sm" onClick={async () => {
              const r = await apiPost("/api/channels", { action: "invite", id: ch.id, nick });
              if (r?.ok) { setInfo(r.already ? "Уже подписан." : "Приглашение отправлено."); setNick(""); } else setInfo(r?.error === "no_user" ? "Такого пользователя нет." : r?.error === "banned_here" ? "Пользователь заблокирован в канале." : "Не получилось.");
            }}>Позвать</button>
          </div>
          {info && <p className="text-goldSoft text-sm mt-2">{info}</p>}
        </div>
      ) : (
        <div className="overflow-y-auto overscroll-contain flex flex-col gap-2">
          {kind === "members" && <button onClick={() => setBanned(!banned)} className="text-xs text-gold text-left">{banned ? "← К подписчикам" : "Показать заблокированных"}</button>}
          {users.length === 0 && <p className="text-muted text-sm text-center py-4">Пусто.</p>}
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 text-sm text-offwhite">
              <span className="truncate">{u.name}</span>
              <span className="flex gap-2 flex-shrink-0">
                {kind === "requests" ? (
                  <>
                    <button className="rounded-full bg-gold text-black px-3 py-1 text-xs font-semibold" onClick={() => act("decide", u.id, { accept: true })}>Принять</button>
                    <button className="rounded-full border border-muted px-3 py-1 text-xs" onClick={() => act("decide", u.id, { accept: false })}>Отклонить</button>
                  </>
                ) : banned ? (
                  <button className="rounded-full border border-muted px-3 py-1 text-xs" onClick={() => act("unban", u.id)}>Разблокировать</button>
                ) : (
                  <>
                    <button className="rounded-full border border-muted px-3 py-1 text-xs" onClick={() => act("kick", u.id)}>Исключить</button>
                    <button className="rounded-full border border-danger text-danger px-3 py-1 text-xs" onClick={() => act("ban", u.id)}>Блок</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function ReportSheet({ target, chId, onClose }: { target: { postId?: string; commentId?: string; channel?: boolean }; chId: string; onClose: (sent: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  async function send(reason: string) {
    setBusy(true);
    await apiPost("/api/channels", target.channel ? { action: "report_channel", id: chId, reason } : { action: "report", postId: target.postId, commentId: target.commentId, reason });
    onClose(true);
  }
  return (
    <Sheet title="Пожаловаться" onClose={() => onClose(false)}>
      <div className="flex flex-col gap-2">
        {REASONS.map(([k, t]) => (
          <button key={k} disabled={busy} onClick={() => send(k)} className="text-left border border-muted rounded-xl px-4 py-3 text-sm text-offwhite">{t}</button>
        ))}
      </div>
    </Sheet>
  );
}
