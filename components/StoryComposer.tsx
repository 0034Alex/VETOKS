"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import { cleanImage } from "@/lib/imageClean";
import { bunnyUpload, videoDuration } from "@/lib/bunnyUpload";

type SVis = "all" | "followers" | "friends";
const VIS: { v: SVis; t: string; d: string }[] = [
  { v: "all", t: "Все", d: "Видят все, кто на вас подписан" },
  { v: "followers", t: "Подписчики", d: "Только ваши подписчики" },
  { v: "friends", t: "Избранные друзья", d: "Только те, кого вы выбрали" },
];
const MAX_SEC = 30;

export type StoryDraft = { id: string; media: any[]; vis: SVis } | null;

const ERR: Record<string, string> = {
  too_many: "Уже 10 активных историй. Дождитесь, пока одна исчезнет, или удалите.",
  too_long: "Видео длиннее 30 секунд.",
  unavailable: "Публикации сейчас закрыты.",
  held: "Фото не прошло проверку. Выберите другое.",
  bad_file: "Файл не подходит.",
  bad_url: "Файл не подходит.",
};

// Новая история: одно фото или видео до 30 секунд. Живёт 24 часа.
export default function StoryComposer({ isPart, draft, onDraftSaved }: { isPart: boolean; draft: StoryDraft; onDraftSaved: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const first = draft?.media?.[0];
  const [kind, setKind] = useState<"photo" | "video" | null>(first ? (first.kind === "video" ? "video" : "photo") : null);
  const [preview, setPreview] = useState<string | null>(first?.kind === "photo" ? first.url : null);
  const [url, setUrl] = useState<string | undefined>(first?.url || undefined);
  const [videoId, setVideoId] = useState<string | undefined>(first?.videoId || undefined);
  const [progress, setProgress] = useState(first ? 100 : 0);
  const [vis, setVis] = useState<SVis>(draft?.vis ?? "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [friendsOpen, setFriendsOpen] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    const isVideo = f.type.startsWith("video/");
    if (!isVideo && !f.type.startsWith("image/")) return setError("Этот файл не похож на фото или видео.");
    setKind(isVideo ? "video" : "photo");
    setPreview(URL.createObjectURL(f));
    setUrl(undefined);
    setVideoId(undefined);
    setProgress(1);
    try {
      if (isVideo) {
        const dur = await videoDuration(f);
        if (dur > MAX_SEC + 0.5) {
          setKind(null);
          setPreview(null);
          setProgress(0);
          return setError("Видео длиннее 30 секунд. Обрежьте его и загрузите снова.");
        }
        const up = isPart ? await apiPost("/api/video/create-upload", {}) : null;
        if (up?.ok && up.configured) {
          await bunnyUpload(f, { videoId: up.videoId, libraryId: up.libraryId, signature: up.signature, expire: up.expire }, (pct) => setProgress(Math.min(99, pct)));
          setVideoId(up.videoId);
          setProgress(100);
          return;
        }
        if (up && up.ok === false) throw new Error("Сервис видео временно недоступен");
      }
      const u = await getCurrentUser();
      const fc = isVideo ? f : await cleanImage(f);
      const ext = (fc.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
      const path = `${u?.id}-${Date.now()}-story.${ext}`;
      const bucket = isVideo ? "media-videos" : "participant-photos";
      const { error: er } = await supabase.storage.from(bucket).upload(path, fc);
      if (er) throw new Error(`Ошибка загрузки: ${er.message}`);
      setUrl(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
      setProgress(100);
    } catch (er: any) {
      setError(er?.message || "Ошибка загрузки");
      setProgress(0);
      setKind(null);
      setPreview(null);
    }
  }

  const ready = !!kind && progress === 100 && !!(url || videoId);
  const media = () => ({ kind, url, videoId });

  async function publish() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const r = await apiPost("/api/story", { action: "create", media: media(), visibility: vis, draftId: draft?.id });
    setBusy(false);
    if (!r?.ok) return setError(ERR[r?.error] || "Не удалось опубликовать. Попробуйте ещё раз.");
    router.push("/");
  }

  async function saveDraft() {
    if (!ready || busy) return;
    setBusy(true);
    const r = await apiPost("/api/post/drafts", {
      action: "save",
      id: draft?.id,
      media: [media()],
      caption: "",
      visibility: "all",
      settings: { story: true, vis },
    });
    setBusy(false);
    if (!r?.ok) return setError(r?.error === "too_many" ? "Черновиков уже 20. Удалите ненужные." : "Не удалось сохранить.");
    onDraftSaved();
  }

  return (
    <div className="px-4 pb-32">
      <input ref={ref} type="file" accept="image/*,video/*" className="hidden" onChange={onPick} />
      <div className="flex flex-col items-center mb-4">
        {!kind ? (
          <button onClick={() => ref.current?.click()} className="w-40 h-60 rounded-3xl border-2 border-dashed border-gold/60 text-gold flex flex-col items-center justify-center gap-2" aria-label="Добавить фото или видео">
            <span className="text-4xl">+</span>
            <span className="text-sm">Фото или видео</span>
            <span className="text-[11px] text-muted">до 30 секунд</span>
          </button>
        ) : (
          <div className="relative w-40 h-60 rounded-3xl overflow-hidden bg-bgSurface border border-gold/40">
            {kind === "photo" && preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : preview ? (
              <video src={preview} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">▶</div>
            )}
            {progress < 100 && (
              <div className="absolute inset-x-0 bottom-0 bg-black/60 text-center text-xs text-white py-1">Загрузка {progress}%</div>
            )}
            <button
              onClick={() => {
                setKind(null);
                setPreview(null);
                setUrl(undefined);
                setVideoId(undefined);
                setProgress(0);
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-sm"
              aria-label="Убрать"
            >
              ✕
            </button>
          </div>
        )}
        <p className="text-muted text-xs mt-3 text-center">История исчезнет через 24 часа. Можно держать до 10 историй сразу.</p>
      </div>

      <p className="text-offwhite text-sm font-semibold mb-2">Кто увидит</p>
      <div className="flex flex-col gap-2 mb-2">
        {VIS.map((o) => (
          <button key={o.v} onClick={() => setVis(o.v)} className={`text-left rounded-xl border px-4 py-3 ${vis === o.v ? "border-gold bg-gold/10" : "border-muted/40 bg-bgSurface"}`}>
            <span className={`block text-sm font-semibold ${vis === o.v ? "text-gold" : "text-offwhite"}`}>{o.t}</span>
            <span className="block text-xs text-muted">{o.d}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setFriendsOpen(true)} className="text-gold text-sm underline mb-5">
        Настроить избранных друзей
      </button>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={saveDraft} disabled={!ready || busy} className="flex-1 border border-gold text-gold rounded-full py-3 text-sm font-semibold disabled:opacity-40">
          В черновики
        </button>
        <button onClick={publish} disabled={!ready || busy} className="flex-1 bg-gold text-bgPrimary rounded-full py-3 text-sm font-semibold disabled:opacity-40">
          {busy ? "…" : "Опубликовать"}
        </button>
      </div>

      {friendsOpen && <FriendsSheet onClose={() => setFriendsOpen(false)} />}
    </div>
  );
}

function FriendsSheet({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; name: string; photo: string | null }[] | null>(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ nick: string; name: string; photoUrl: string | null }[]>([]);
  const [msg, setMsg] = useState("");
  const loaded = useRef(false);
  if (!loaded.current) {
    loaded.current = true;
    apiPost("/api/story", { action: "friends" }).then((r) => setItems(r?.ok ? r.items : []));
  }

  async function search(v: string) {
    setQ(v);
    const nick = v.trim().replace(/^@/, "").toLowerCase();
    if (nick.length < 2) return setRes([]);
    const r = await apiPost("/api/profile/search", { q: nick });
    setRes(r?.ok ? r.items : []);
  }
  async function add(nick: string) {
    const r = await apiPost("/api/story", { action: "friend_add", nick });
    if (!r?.ok) return setMsg(r?.error === "too_many" ? "Не больше 300 друзей." : "Не нашли такого человека.");
    setMsg("");
    setQ("");
    setRes([]);
    const l = await apiPost("/api/story", { action: "friends" });
    setItems(l?.ok ? l.items : []);
  }
  async function remove(id: string) {
    await apiPost("/api/story", { action: "friend_remove", id });
    setItems((a) => (a ? a.filter((x) => x.id !== id) : a));
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end bg-black/70" onClick={onClose}>
      <div className="w-full max-h-[80dvh] overflow-y-auto bg-bgSurface rounded-t-3xl px-4 pt-3 pb-8" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
        <i className="block w-10 h-1 rounded-full bg-muted/50 mx-auto mb-3" />
        <p className="text-offwhite font-semibold mb-2">Избранные друзья</p>
        <input value={q} onChange={(e) => search(e.target.value)} placeholder="Найти по нику, например @anna" className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
        {msg && <p className="text-danger text-xs mb-2">{msg}</p>}
        {res.map((p) => (
          <button key={p.nick} onClick={() => add(p.nick)} className="w-full flex items-center gap-3 py-2 text-left">
            <span className="w-9 h-9 rounded-full overflow-hidden bg-black/40 flex-none">
              {p.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
              )}
            </span>
            <span className="flex-1 text-offwhite text-sm">{p.name} <span className="text-muted">@{p.nick}</span></span>
            <span className="text-gold text-sm">+ Добавить</span>
          </button>
        ))}
        <p className="text-muted text-xs mt-3 mb-1">В списке: {items?.length ?? 0}</p>
        {items?.map((f) => (
          <div key={f.id} className="flex items-center gap-3 py-2 border-b border-muted/20">
            <span className="w-9 h-9 rounded-full overflow-hidden bg-black/40 flex-none">
              {f.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.photo} alt="" className="w-full h-full object-cover" />
              )}
            </span>
            <span className="flex-1 text-offwhite text-sm">{f.name}</span>
            <button onClick={() => remove(f.id)} className="text-danger text-xs">Убрать</button>
          </div>
        ))}
        {items && items.length === 0 && <p className="text-muted text-sm">Пока никого. Найдите людей по нику выше.</p>}
      </div>
    </div>
  );
}
