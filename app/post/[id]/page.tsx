"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PostRepostTag from "@/components/PostRepostTag";

type P = {
  id: string;
  kind: "video" | "photo";
  url: string;
  caption: string;
  createdAt: string;
  views: number;
  ownerUserId: string;
  authorName: string;
  authorSub: string;
  authorPhoto: string | null;
  authorHref: string;
  likes: number;
  liked: boolean;
  comments: number;
  reposted: boolean;
  mine: boolean;
};

type Cm = { id: string; body: string; created_at: string; users: { first_name: string | null } | { first_name: string | null }[] | null };

const Heart = ({ on }: { on: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={on ? "#EC4899" : "none"} stroke={on ? "#EC4899" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" />
  </svg>
);
const Bubble = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
  </svg>
);
const Send = () => (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 3 10.5 13.5" />
    <path d="M21.5 3 14.5 21l-4-7.5L3 9.5 21.5 3z" />
  </svg>
);

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

// Лента публикаций человека: открываешь любую и листаешь остальные вниз и вверх.
export default function PostFeedPage() {
  const params = useParams();
  const router = useRouter();
  const startId = params.id as string;
  const [items, setItems] = useState<P[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [cOpen, setCOpen] = useState<string | null>(null);
  const [cList, setCList] = useState<Cm[]>([]);
  const [cText, setCText] = useState("");
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const viewed = useRef<Set<string>>(new Set());
  const scrolled = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/login?redirect=/post/${startId}`);
        return;
      }
      const qs = new URLSearchParams(window.location.search);
      let u = qs.get("u") || "";
      const tab = qs.get("tab") || "feed";

      if (!u) {
        const one = await apiPost("/api/profile/post", { postId: startId });
        if (!one?.ok) {
          setMissing(true);
          return;
        }
        u = one.post.ownerUserId;
      }
      const c = await apiPost("/api/profile/content", { userId: u });
      let list: { postId: string }[] = [];
      if (c?.ok) list = tab === "video" ? c.videos : tab === "rep" ? c.reposts : tab === "tag" ? c.tags : c.feed;
      let ids = list.map((x) => x.postId);
      if (!ids.includes(startId)) ids = [startId, ...ids];

      const r = await apiPost("/api/profile/posts", { ids });
      if (!r?.ok || !r.items?.length) {
        setMissing(true);
        return;
      }
      const byId: Record<string, P> = {};
      (r.items as P[]).forEach((p) => (byId[p.id] = p));
      setItems(ids.map((id) => byId[id]).filter(Boolean));
      setMeId(r.meId as string);
    })();
  }, [startId, router]);

  // Встаём на открытую публикацию.
  useEffect(() => {
    if (!items || scrolled.current) return;
    scrolled.current = true;
    cardRefs.current[startId]?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [items, startId]);

  // Видео играет, пока на экране; просмотр засчитывается один раз.
  useEffect(() => {
    if (!items) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          const id = v.dataset.id as string;
          if (e.isIntersecting) {
            v.play().catch(() => {});
            if (!viewed.current.has(id)) {
              viewed.current.add(id);
              apiPost("/api/profile/view", { postId: id }).then((r) => {
                if (r?.ok && typeof r.views === "number") setItems((prev) => prev && prev.map((p) => (p.id === id ? { ...p, views: r.views } : p)));
              });
            }
          } else v.pause();
        });
      },
      { threshold: 0.6 }
    );
    Object.values(videoRefs.current).forEach((v) => v && obs.observe(v));
    return () => obs.disconnect();
  }, [items]);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2200);
  }

  async function toggleLike(p: P) {
    if (!meId) return;
    if (p.liked) await supabase.from("media_likes").delete().eq("post_id", p.id).eq("user_id", meId);
    else await supabase.from("media_likes").insert({ post_id: p.id, user_id: meId });
    setItems((prev) => prev && prev.map((x) => (x.id === p.id ? { ...x, liked: !p.liked, likes: Math.max(0, x.likes + (p.liked ? -1 : 1)) } : x)));
  }

  async function openComments(id: string) {
    setCOpen(id);
    const { data } = await supabase
      .from("media_comments")
      .select("id, body, created_at, users(first_name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    setCList((data as unknown as Cm[]) ?? []);
  }

  async function sendComment() {
    if (!meId || !cOpen || !cText.trim()) return;
    await supabase.from("media_comments").insert({ post_id: cOpen, user_id: meId, body: cText.trim().slice(0, 500) });
    setCText("");
    setItems((prev) => prev && prev.map((x) => (x.id === cOpen ? { ...x, comments: x.comments + 1 } : x)));
    await openComments(cOpen);
  }

  async function report(p: P) {
    setMenuFor(null);
    const r = await apiPost("/api/reports/create", { postId: p.id, reason: "other" });
    flash(r?.ok ? "Жалоба отправлена" : "Не получилось отправить");
  }

  async function share(p: P) {
    const url = `${window.location.origin}/post/${p.id}`;
    if (navigator.share) navigator.share({ title: "VETOKS", url }).catch(() => {});
    else {
      try {
        await navigator.clipboard.writeText(url);
        flash("Ссылка скопирована");
      } catch {
        flash(url);
      }
    }
  }

  if (missing) return <main className="min-h-screen flex items-center justify-center text-muted">Публикация не найдена.</main>;
  if (!items) return <LoadingScreen />;

  return (
    <main className="min-h-screen pb-36 bg-bgPrimary">
      <div className="max-w-md mx-auto">
        <div
          className="sticky top-0 z-20 flex items-center gap-3 px-4 pb-3 bg-bgPrimary/95 backdrop-blur border-b border-muted/30"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <button onClick={() => router.back()} className="text-offwhite text-2xl leading-none" aria-label="Назад">
            ←
          </button>
          <p className="text-offwhite font-semibold">Публикации</p>
        </div>

        {items.map((p) => (
          <article
            key={p.id}
            ref={(el) => {
              cardRefs.current[p.id] = el;
            }}
            className="border-b border-muted/30 pb-4"
            style={{ scrollMarginTop: "calc(env(safe-area-inset-top) + 56px)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Link href={p.authorHref} className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] border border-gold/60 bg-cover bg-center flex-none flex items-center justify-center text-white font-semibold text-sm"
                  style={p.authorPhoto ? { backgroundImage: `url(${p.authorPhoto})` } : undefined}
                >
                  {!p.authorPhoto && (p.authorName || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-offwhite text-sm font-semibold truncate">{p.authorName}</span>
                  {p.authorSub && <span className="block text-muted text-xs truncate">{p.authorSub}</span>}
                </span>
              </Link>
              {!p.mine && (
                <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="text-offwhite text-2xl leading-none px-2" aria-label="Меню">
                  ⋯
                </button>
              )}
            </div>
            {menuFor === p.id && (
              <div className="px-4 pb-2">
                <button onClick={() => report(p)} className="text-danger text-sm border border-danger rounded-full px-4 py-1.5">
                  Пожаловаться
                </button>
              </div>
            )}

            <div className="relative bg-black">
              {p.kind === "video" ? (
                <>
                  <video
                    ref={(el) => {
                      videoRefs.current[p.id] = el;
                    }}
                    data-id={p.id}
                    src={p.url}
                    loop
                    muted={muted}
                    playsInline
                    onClick={() => setMuted((m) => !m)}
                    className="w-full max-h-[78vh] object-contain"
                  />
                  <span className="absolute right-3 bottom-3 w-8 h-8 rounded-full bg-black/60 text-white text-sm flex items-center justify-center pointer-events-none">
                    {muted ? "🔇" : "🔊"}
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="w-full max-h-[78vh] object-contain" />
              )}
            </div>

            <div className="flex items-center gap-5 px-4 pt-3 text-offwhite">
              <button onClick={() => toggleLike(p)} className="flex items-center gap-1.5" aria-label="Нравится">
                <Heart on={p.liked} />
                <span className="text-sm">{p.likes}</span>
              </button>
              <button onClick={() => openComments(p.id)} className="flex items-center gap-1.5" aria-label="Комментарии">
                <Bubble />
                <span className="text-sm">{p.comments}</span>
              </button>
              <PostRepostTag postId={p.id} ownerUserId={p.ownerUserId} meId={meId} compact initialReposted={p.reposted} />
              <button onClick={() => share(p)} className="ml-auto" aria-label="Поделиться">
                <Send />
              </button>
            </div>

            {p.kind === "video" && <p className="px-4 pt-2 text-offwhite text-sm font-semibold">{p.views.toLocaleString("ru-RU")} просмотров</p>}
            {p.caption && (
              <p className="px-4 pt-1.5 text-offwhite text-sm whitespace-pre-line">
                <b className="mr-1.5">{p.authorName}</b>
                {p.caption}
              </p>
            )}
            {p.comments > 0 && (
              <button onClick={() => openComments(p.id)} className="px-4 pt-1.5 text-muted text-sm block">
                Все комментарии ({p.comments})
              </button>
            )}
            <p className="px-4 pt-1.5 text-muted text-[11px] uppercase tracking-wide">{fmtDate(p.createdAt)}</p>
          </article>
        ))}
      </div>

      {cOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setCOpen(null)}>
          <div
            className="bg-bgSurface w-full max-w-md mx-auto max-h-[75vh] rounded-t-2xl p-4 flex flex-col"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-offwhite font-semibold">Комментарии</span>
              <button onClick={() => setCOpen(null)} className="text-muted text-xl" aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex flex-col gap-3 mb-3">
              {cList.length === 0 && <p className="text-muted text-sm text-center py-4">Комментариев пока нет.</p>}
              {cList.map((c) => (
                <p key={c.id} className="text-offwhite text-sm">
                  <b className="mr-1.5">{(Array.isArray(c.users) ? c.users[0]?.first_name : c.users?.first_name) ?? "Гость"}</b>
                  {c.body}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={cText}
                onChange={(e) => setCText(e.target.value)}
                placeholder="Ваш комментарий"
                className="flex-1 bg-bgPrimary text-offwhite border border-muted rounded-full px-4 py-2 text-sm"
              />
              <button onClick={sendComment} className="bg-gold text-bgPrimary font-semibold rounded-full px-4 text-sm">
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">{toast}</div>
      )}
      <BottomNav />
    </main>
  );
}
