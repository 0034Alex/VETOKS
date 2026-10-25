"use client";

import { cleanImage } from "@/lib/imageClean";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { bunnyUpload, videoDuration } from "@/lib/bunnyUpload";
import BottomNav from "@/components/BottomNav";

const MAX_ITEMS = 10;
type Vis = "all" | "followers" | "me";
type Item = {
  key: string;
  kind: "photo" | "video";
  preview: string | null; // что показываем в плитке
  url?: string; // готовая ссылка (фото, видео без Bunny)
  videoId?: string; // видео в Bunny
  progress: number; // 0..100, 100 = готово
  error?: string;
};
type Place = { id?: string; name: string };
type Person = { nick: string; name: string };
type Sheet = null | "vis" | "place" | "people";

const VIS: { v: Vis; t: string; d: string }[] = [
  { v: "all", t: "Все", d: "Лента, профиль и поиск" },
  { v: "followers", t: "Подписчики", d: "Только те, кто на вас подписан" },
  { v: "me", t: "Только я", d: "Видна только вам в профиле" },
];

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [mode, setMode] = useState<"edit" | "drafts">(sp.get("drafts") ? "drafts" : "edit");
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [vis, setVis] = useState<Vis>("all");
  const [place, setPlace] = useState<Place | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowReposts, setAllowReposts] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queued, setQueued] = useState(false);
  const [isPart, setIsPart] = useState(false);
  const libRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/add-video");
        return;
      }
      const { data: p } = await supabase.from("participants").select("id").eq("user_id", u.id).maybeSingle();
      setIsPart(!!p);
      loadDrafts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDrafts() {
    const r = await apiPost("/api/post/drafts", { action: "list" });
    setDrafts(r?.ok ? r.items : []);
  }

  const patch = (key: string, p: Partial<Item>) => setItems((a) => a.map((x) => (x.key === key ? { ...x, ...p } : x)));

  // Каждый файл загружаем сразу после выбора, чтобы потом публикация и черновик были мгновенными.
  async function uploadOne(f: File, key: string) {
    const isVideo = f.type.startsWith("video/");
    try {
      if (isVideo) {
        const dur = await videoDuration(f);
        if (dur > 60.5) {
          patch(key, { error: "Видео длиннее 60 секунд", progress: 0 });
          return;
        }
        const up = isPart ? await apiPost("/api/video/create-upload", {}) : null;
        if (up?.ok && up.configured) {
          await bunnyUpload(
            f,
            { videoId: up.videoId, libraryId: up.libraryId, signature: up.signature, expire: up.expire },
            (pct) => patch(key, { progress: Math.min(99, pct) })
          );
          patch(key, { videoId: up.videoId, progress: 100 });
          return;
        }
        if (up && up.ok === false) {
          patch(key, { error: "Сервис видео временно недоступен" });
          return;
        }
      }
      const u = await getCurrentUser();
      const fc = isVideo ? f : await cleanImage(f);
      const ext = (fc.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
      const path = `${u?.id}-${Date.now()}-${key}.${ext}`;
      const bucket = isVideo ? "media-videos" : "participant-photos";
      const { error: e } = await supabase.storage.from(bucket).upload(path, fc);
      if (e) {
        patch(key, { error: `Ошибка загрузки: ${e.message}` });
        return;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      patch(key, { url: data.publicUrl, progress: 100 });
    } catch (e: any) {
      patch(key, { error: e?.message || "Ошибка загрузки" });
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files: File[] = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError("");
    const room = MAX_ITEMS - items.length;
    if (files.length > room) setError(`Можно не больше ${MAX_ITEMS} фото и видео в одной публикации.`);
    const add: Item[] = [];
    files.slice(0, Math.max(0, room)).forEach((f: File, i: number) => {
      const kind = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "photo" : null;
      if (!kind) {
        setError("Этот файл не похож на фото или видео.");
        return;
      }
      const key = `${Date.now()}-${i}`;
      add.push({ key, kind, preview: URL.createObjectURL(f), progress: 0 });
      uploadOne(f, key);
    });
    if (add.length) setItems((a) => [...a, ...add]);
  }

  function move(i: number) {
    setItems((a) => {
      if (i <= 0) return a;
      const b = [...a];
      [b[i - 1], b[i]] = [b[i], b[i - 1]];
      return b;
    });
  }
  const remove = (key: string) => setItems((a) => a.filter((x) => x.key !== key));

  const uploading = items.some((x) => !x.error && x.progress < 100);
  const failed = items.some((x) => x.error);
  const ready = items.length > 0 && !uploading && !failed;

  const mediaPayload = () => items.map((x) => ({ kind: x.kind, url: x.url, videoId: x.videoId }));

  async function publish() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const r = await apiPost("/api/post/create", {
      media: mediaPayload(),
      caption,
      visibility: vis,
      placeId: place?.id,
      placeName: place && !place.id ? place.name : undefined,
      allowComments,
      allowLikes,
      allowReposts,
      draftId,
      tags: people.map((p) => p.nick),
    });
    if (r?.ok && r.queued) {
      setBusy(false);
      setQueued(true);
      return;
    }
    if (!r?.ok) {
      setError(
        r?.error === "bad_words"
          ? "Есть недопустимые слова. Перепишите без грубостей."
          : r?.error === "too_long"
          ? "Видео длиннее 60 секунд."
          : r?.error === "already_used"
          ? "Это видео уже опубликовано."
          : r?.error === "too_many"
          ? "Черновиков уже 20. Удалите ненужные."
          : "Не удалось опубликовать. Попробуйте ещё раз."
      );
      setBusy(false);
      return;
    }
    for (const p of people) await apiPost("/api/profile/tags", { action: "tag", postId: r.postId, nick: p.nick });
    router.push(`/post/${r.postId}`);
  }

  async function saveDraft() {
    if (busy) return;
    if (uploading) {
      setError("Подождите, файлы ещё загружаются.");
      return;
    }
    setBusy(true);
    const r = await apiPost("/api/post/drafts", {
      action: "save",
      id: draftId,
      media: items.filter((x) => !x.error).map((x) => ({ kind: x.kind, url: x.url, videoId: x.videoId })),
      caption,
      visibility: vis,
      placeId: place?.id,
      placeName: place && !place.id ? place.name : place?.name,
      tags: people.map((p) => p.nick),
      settings: { comments: allowComments, likes: allowLikes, reposts: allowReposts },
    });
    setBusy(false);
    if (!r?.ok) {
      setError(r?.error === "empty" ? "Добавьте фото, видео или текст." : r?.error === "too_many" ? "Черновиков уже 20. Удалите ненужные." : "Не удалось сохранить.");
      return;
    }
    router.push("/profile");
  }

  async function openDraft(id: string) {
    const r = await apiPost("/api/post/drafts", { action: "get", id });
    if (!r?.ok) return;
    const d = r.draft;
    setDraftId(d.id);
    setCaption(d.caption ?? "");
    setVis((d.visibility as Vis) || "all");
    setAllowComments(d.settings?.comments !== false);
    setAllowLikes(d.settings?.likes !== false);
    setAllowReposts(d.settings?.reposts !== false);
    setPlace(d.place_name ? { id: d.place_id || undefined, name: d.place_name } : null);
    setItems(
      ((d.media as any[]) ?? []).map((m, i) => ({
        key: `d${i}-${Date.now()}`,
        kind: m.kind === "video" ? "video" : "photo",
        preview: m.kind === "photo" ? m.url : null,
        url: m.url || undefined,
        videoId: m.videoId || undefined,
        progress: 100,
      }))
    );
    const nicks: string[] = Array.isArray(d.tags) ? d.tags : [];
    setPeople(nicks.map((n) => ({ nick: n, name: n })));
    setMode("edit");
  }

  async function delDraft(id: string) {
    await apiPost("/api/post/drafts", { action: "delete", id });
    setDrafts((a) => (a ? a.filter((x) => x.id !== id) : a));
  }

  const visLabel = VIS.find((x) => x.v === vis)?.t ?? "Все";

  // ---------- Черновики ----------
  if (mode === "drafts") {
    return (
      <main className="min-h-screen pb-28">
        <Top title="Публикация" onBack={() => router.back()} />
        <Tabs mode="drafts" count={drafts?.length ?? 0} set={setMode} />
        <div className="px-4">
          {drafts === null ? (
            <p className="text-muted text-sm text-center mt-10">Загружаем…</p>
          ) : drafts.length === 0 ? (
            <p className="text-muted text-sm text-center mt-10">Черновиков нет.</p>
          ) : (
            drafts.map((d) => {
              const first = (d.media as any[])?.[0];
              return (
                <div key={d.id} className="flex items-center gap-3 py-3 border-b border-muted/30">
                  <button onClick={() => openDraft(d.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="w-14 h-16 rounded-lg bg-bgSurface overflow-hidden flex-none flex items-center justify-center text-muted">
                      {first?.kind === "photo" && first.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={first.url} alt="" className="w-full h-full object-cover" />
                      ) : first ? (
                        "▶"
                      ) : (
                        "✎"
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-offwhite text-sm truncate">{d.caption || "Без описания"}</span>
                      <span className="block text-muted text-xs">
                        {(d.media as any[])?.length ?? 0} шт. · {new Date(d.updated_at).toLocaleDateString("ru-RU")}
                      </span>
                    </span>
                  </button>
                  <button onClick={() => delDraft(d.id)} className="text-danger text-sm px-2" aria-label="Удалить">
                    Удалить
                  </button>
                </div>
              );
            })
          )}
        </div>
        <BottomNav />
      </main>
    );
  }

  // ---------- Новая публикация ----------
  if (queued) {
    return (
      <main className="min-h-screen pb-32">
        <Top title="Публикация" onBack={() => router.push("/profile")} />
        <div className="px-6 pt-16 text-center flex flex-col items-center gap-4">
          <div className="text-5xl">🗓️</div>
          <p className="text-offwhite text-lg font-semibold">Публикации откроются после начала сезона</p>
          <p className="text-muted text-sm max-w-sm">Ваш материал не потерян — он сохранён в черновиках. Когда сезон начнётся, откройте черновик и опубликуйте его в один клик.</p>
          <button onClick={() => { setQueued(false); setItems([]); setCaption(""); setDraftId(null); setPeople([]); setMode("drafts"); loadDrafts(); }} className="mt-2 bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full">
            К черновикам
          </button>
          <button onClick={() => router.push("/profile")} className="text-muted text-sm underline">В профиль</button>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-32">
      <Top title="Публикация" onBack={() => router.back()} />
      <Tabs mode="edit" count={drafts?.length ?? 0} set={setMode} />

      {items.length === 0 && (
        <div className="flex flex-col items-center px-4 pb-5 pt-2">
          <button
            onClick={() => libRef.current?.click()}
            className="w-40 h-48 rounded-3xl border-2 border-dashed border-gold/60 text-gold flex flex-col items-center justify-center gap-2"
            aria-label="Добавить фото или видео"
          >
            <span className="text-5xl leading-none">+</span>
            <span className="text-sm font-semibold">Фото или видео</span>
          </button>
        </div>
      )}
      <div className={`flex gap-2.5 px-4 pb-3 overflow-x-auto ${items.length === 0 ? "hidden" : ""}`}>
        {items.map((it, i) => (
          <div key={it.key} className="relative w-[84px] h-[104px] rounded-xl bg-bgSurface overflow-hidden flex-none">
            {it.preview && it.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.preview} alt="" className="w-full h-full object-cover" />
            ) : it.preview ? (
              <video src={it.preview} muted playsInline preload="metadata" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-muted text-xl">▶</span>
            )}
            <i className="absolute left-1.5 top-1.5 w-5 h-5 rounded-full bg-gold text-bgPrimary text-xs font-bold not-italic flex items-center justify-center">
              {i + 1}
            </i>
            <button onClick={() => remove(it.key)} className="absolute right-1 top-1 w-6 h-6 rounded-full bg-black/70 text-white text-sm leading-none" aria-label="Убрать">
              ×
            </button>
            {i > 0 && (
              <button onClick={() => move(i)} className="absolute left-1 bottom-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs" aria-label="Сдвинуть влево">
                ◀
              </button>
            )}
            {it.kind === "video" && <span className="absolute right-1.5 bottom-1.5 text-[10px] text-white bg-black/60 rounded-full px-1.5">видео</span>}
            {!it.error && it.progress < 100 && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                <div className="h-full bg-gold" style={{ width: `${it.progress}%` }} />
              </div>
            )}
            {it.error && <div className="absolute inset-0 bg-black/75 text-danger text-[10px] p-1.5 flex items-center text-center">{it.error}</div>}
          </div>
        ))}
        {items.length < MAX_ITEMS && (
          <button
            onClick={() => libRef.current?.click()}
            className="w-[84px] h-[104px] rounded-xl border-[1.5px] border-dashed border-gold/60 text-gold text-3xl flex-none flex items-center justify-center"
            aria-label="Добавить фото или видео"
          >
            +
          </button>
        )}
      </div>
      <input ref={libRef} type="file" accept="image/*,video/*" multiple onChange={onPick} className="hidden" />

      <div className="mx-4 bg-bgSurface rounded-2xl px-4 py-3">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 500))}
          placeholder="Добавьте описание…"
          rows={4}
          className="w-full bg-transparent text-offwhite outline-none resize-none text-base"
        />
        <div className="flex justify-between text-xs text-muted border-t border-muted/20 pt-2">
          <span />
          <span>{caption.length} / 500</span>
        </div>
      </div>

      <div className="mx-4 mt-3.5 bg-bgSurface rounded-2xl px-4">
        <Row
          icon={<path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M18 8v6M15 11h6M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />}
          label="Отметить людей"
          value={people.length ? people.map((x) => "@" + x.nick).join(", ") : "Никого"}
          active={people.length > 0}
          onClick={() => setSheet("people")}
        />
        <Row
          icon={<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />}
          label="Добавить место"
          value={place ? place.name : "Не выбрано"}
          active={!!place}
          onClick={() => setSheet("place")}
        />
        <Row
          icon={<path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />}
          label="Кто видит"
          value={visLabel}
          active={vis !== "all"}
          onClick={() => setSheet("vis")}
          last
        />
      </div>

      <div className="mx-4 mt-3.5 bg-bgSurface rounded-2xl px-4 py-1">
        <p className="text-muted text-xs uppercase tracking-wider pt-3 pb-1">Взаимодействие</p>
        <Toggle label="Комментарии" on={allowComments} set={setAllowComments} />
        <Toggle label="Лайки" on={allowLikes} set={setAllowLikes} />
        <Toggle label="Репосты" on={allowReposts} set={setAllowReposts} last />
      </div>

      {error && <p className="text-danger text-sm px-4 mt-3">{error}</p>}

      <div className="px-4 mt-5 flex gap-2.5">
        <button onClick={saveDraft} disabled={busy} className="px-5 py-3 rounded-full border border-muted text-offwhite font-semibold disabled:opacity-50">
          В черновики
        </button>
        <button onClick={publish} disabled={!ready || busy} className="flex-1 bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50">
          {busy ? "Публикуем…" : uploading ? "Загружаем файлы…" : "Опубликовать"}
        </button>
      </div>

      {sheet === "vis" && (
        <Sheet title="Кто видит публикацию" onClose={() => setSheet(null)}>
          {VIS.map((o) => (
            <button key={o.v} onClick={() => setVis(o.v)} className="w-full flex items-center gap-3 py-3.5 border-b border-muted/20 text-left">
              <span className="flex-1">
                <span className="block text-offwhite">{o.t}</span>
                <span className="block text-muted text-xs">{o.d}</span>
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${vis === o.v ? "border-gold" : "border-muted"}`}>
                {vis === o.v && <i className="w-2.5 h-2.5 rounded-full bg-gold block" />}
              </span>
            </button>
          ))}
          <button onClick={() => setSheet(null)} className="mt-4 w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full">
            Готово
          </button>
        </Sheet>
      )}
      {sheet === "place" && (
        <PlaceSheet
          current={place}
          onClose={() => setSheet(null)}
          onPick={(p) => {
            setPlace(p);
            setSheet(null);
          }}
        />
      )}
      {sheet === "people" && <PeopleSheet people={people} onChange={setPeople} onClose={() => setSheet(null)} />}
      <BottomNav />
    </main>
  );
}

function Top({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
      <button onClick={onBack} className="text-offwhite text-xl w-8 text-left" aria-label="Назад">
        ←
      </button>
      <b className="text-offwhite text-[17px]">{title}</b>
      <span className="min-w-[32px] text-right">{right}</span>
    </div>
  );
}

function Tabs({ mode, count, set }: { mode: "edit" | "drafts"; count: number; set: (m: "edit" | "drafts") => void }) {
  const cls = (on: boolean) =>
    `flex-1 text-center rounded-full py-2 text-sm font-semibold transition-colors ${on ? "bg-gold text-bgPrimary" : "text-muted"}`;
  return (
    <div className="mx-4 mb-4 flex bg-bgSurface rounded-full p-1">
      <button onClick={() => set("edit")} className={cls(mode === "edit")}>
        Новая
      </button>
      <button onClick={() => set("drafts")} className={cls(mode === "drafts")}>
        Черновики{count > 0 ? ` ${count}` : ""}
      </button>
    </div>
  );
}

function Toggle({ label, on, set, last }: { label: string; on: boolean; set: (v: boolean) => void; last?: boolean }) {
  return (
    <button onClick={() => set(!on)} className={`w-full flex items-center justify-between py-3.5 text-left ${last ? "" : "border-b border-muted/20"}`} role="switch" aria-checked={on}>
      <span className="text-offwhite">{label}</span>
      <span className={`w-11 h-[26px] rounded-full relative transition-colors ${on ? "bg-gold" : "bg-muted/40"}`}>
        <i className={`absolute top-[3px] w-5 h-5 rounded-full bg-bgPrimary transition-all ${on ? "right-[3px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}

function Row({ icon, label, value, active, onClick, last }: { icon: React.ReactNode; label: string; value: string; active?: boolean; onClick: () => void; last?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 py-3.5 text-left ${last ? "" : "border-b border-muted/20"}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8D48A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
        {icon}
      </svg>
      <span className="flex-1 text-offwhite text-base">{label}</span>
      <span className={`text-sm max-w-[45%] truncate ${active ? "text-gold" : "text-muted"}`}>{value}</span>
      <span className="text-muted">›</span>
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/70" onClick={onClose}>
      <div
        className="w-full max-h-[80dvh] overflow-y-auto bg-bgSurface rounded-t-3xl px-4 pt-3 pb-8"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <i className="block w-10 h-1 rounded-full bg-muted/50 mx-auto mb-3" />
        <p className="text-offwhite font-semibold mb-2">{title}</p>
        {children}
      </div>
    </div>
  );
}

function PlaceSheet({ current, onClose, onPick }: { current: Place | null; onClose: () => void; onPick: (p: Place | null) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<{ id: string; name: string; count: number }[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await apiPost("/api/places", { action: "search", q });
      if (r?.ok) setList(r.items);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const name = q.trim().replace(/\s+/g, " ");
  const exact = list.some((p) => p.name.toLowerCase() === name.toLowerCase());
  return (
    <Sheet title="Добавить место" onClose={onClose}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value.slice(0, 60))}
        placeholder="Название места…"
        autoFocus
        className="w-full bg-bgPrimary border border-gold/50 rounded-xl px-3.5 py-3 text-offwhite outline-none mb-1"
      />
      {list.map((p) => (
        <button key={p.id} onClick={() => onPick({ id: p.id, name: p.name })} className="w-full flex items-center gap-3 py-3 border-b border-muted/20 text-left">
          <span>📍</span>
          <span className="flex-1 min-w-0">
            <span className="block text-offwhite truncate">{p.name}</span>
            <span className="block text-muted text-xs">{p.count} публикаций</span>
          </span>
        </button>
      ))}
      {name.length >= 2 && !exact && (
        <button onClick={() => onPick({ name })} className="w-full flex items-center gap-3 py-3.5 text-left text-gold font-semibold">
          <span className="w-5 text-center text-lg">+</span>Добавить новое: «{name}»
        </button>
      )}
      {current && (
        <button onClick={() => onPick(null)} className="mt-2 text-danger text-sm">
          Убрать место
        </button>
      )}
      <p className="text-muted text-xs mt-3">Нажатие на место в публикации открывает все публикации оттуда.</p>
    </Sheet>
  );
}

function PeopleSheet({ people, onChange, onClose }: { people: Person[]; onChange: (p: Person[]) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ nick: string; name: string; photoUrl: string | null }[]>([]);
  useEffect(() => {
    const nick = q.trim().replace(/^@/, "");
    if (nick.length < 2) {
      setRes([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await apiPost("/api/profile/search", { q: nick });
      if (r?.ok) setRes(r.items);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const has = (n: string) => people.some((p) => p.nick === n);
  return (
    <Sheet title="Отметить людей" onClose={onClose}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ник человека…"
        autoFocus
        className="w-full bg-bgPrimary border border-gold/50 rounded-xl px-3.5 py-3 text-offwhite outline-none mb-2"
      />
      {people.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {people.map((p) => (
            <button key={p.nick} onClick={() => onChange(people.filter((x) => x.nick !== p.nick))} className="bg-bgPrimary border border-gold/60 text-gold rounded-full px-3 py-1 text-sm">
              @{p.nick} ×
            </button>
          ))}
        </div>
      )}
      {res.map((r) => (
        <button
          key={r.nick}
          disabled={has(r.nick) || people.length >= 10}
          onClick={() => onChange([...people, { nick: r.nick, name: r.name }])}
          className="w-full flex items-center gap-3 py-2.5 border-b border-muted/20 text-left disabled:opacity-40"
        >
          <span
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] bg-cover bg-center flex-none"
            style={r.photoUrl ? { backgroundImage: `url(${r.photoUrl})` } : undefined}
          />
          <span className="min-w-0">
            <span className="block text-offwhite text-sm truncate">{r.name}</span>
            <span className="block text-muted text-xs">@{r.nick}</span>
          </span>
        </button>
      ))}
      <button onClick={onClose} className="mt-4 w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full">
        Готово
      </button>
      <p className="text-muted text-xs mt-3">Люди получат уведомление об отметке. До 10 человек.</p>
    </Sheet>
  );
}

export default function AddVideoPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
