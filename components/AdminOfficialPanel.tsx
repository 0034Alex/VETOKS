"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

type Row = { countryId: string; country: string; officialId: string | null; photoUrl: string | null };
type Post = { id: string; media_type: string; video_url: string | null; photo_url: string | null; caption: string | null; created_at: string };

// CRM → «Официальный аккаунт»: страница VETOKS в каждой стране, публикации от её имени.
export default function AdminOfficialPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const cid = getCrmCountry();
  const cur = rows.find((r) => r.countryId === cid) ?? null;

  async function load() {
    const r = await apiPost("/api/admin/official", { action: "list" });
    if (r?.ok) setRows(r.items);
  }
  async function loadPosts() {
    if (!cid) return setPosts([]);
    const r = await apiPost("/api/admin/official", { action: "posts", countryId: cid });
    setPosts(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (cur?.officialId) loadPosts();
    else setPosts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.officialId, cid]);

  async function create(countryId: string) {
    setMsg("");
    const r = await apiPost("/api/admin/official", { action: "create", countryId });
    setMsg(r?.ok ? "Аккаунт создан, все люди страны подписаны." : r?.error === "no_regions" ? "В этой стране ещё нет регионов." : "Не получилось создать.");
    load();
  }

  async function upload(f: File): Promise<{ url: string; kind: "video" | "photo" } | null> {
    const kind = f.type.startsWith("video") ? "video" : "photo";
    const bucket = kind === "video" ? "media-videos" : "participant-photos";
    const path = `official-${cid}-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from(bucket).upload(path, f);
    if (error) {
      setMsg("Ошибка загрузки: " + error.message);
      return null;
    }
    return { url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl, kind };
  }

  async function publish() {
    if (!file || !cid) return;
    setBusy(true);
    setMsg("");
    const up = await upload(file);
    if (up) {
      const r = await apiPost("/api/admin/official", { action: "post", countryId: cid, url: up.url, kind: up.kind, caption });
      if (r?.ok) {
        setMsg("Опубликовано.");
        setFile(null);
        setCaption("");
        loadPosts();
      } else setMsg("Не получилось опубликовать.");
    }
    setBusy(false);
  }

  async function setAvatar(f: File) {
    setBusy(true);
    const up = await upload(f);
    if (up && up.kind === "photo") {
      await apiPost("/api/admin/official", { action: "photo", countryId: cid, url: up.url });
      setMsg("Аватар обновлён.");
      load();
    }
    setBusy(false);
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <div>
        <p className="text-muted text-sm mb-2">Ник у всех: <b className="text-offwhite">@vetoks_official</b>, имя: <b className="text-offwhite">VETOKS_OFFICIAL</b>. Свой аккаунт в каждой стране, люди разных стран друг друга не видят.</p>
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.countryId} className="flex items-center gap-3 bg-bgPrimary border border-muted rounded-xl px-3 py-2 text-sm">
              <span className={`flex-1 ${r.countryId === cid ? "text-gold font-semibold" : "text-offwhite"}`}>{r.country}</span>
              {r.officialId ? <span className="text-success text-xs">создан</span> : <button onClick={() => create(r.countryId)} className="bg-gold text-bgPrimary rounded-full px-3 py-1 text-xs font-semibold">Создать</button>}
            </div>
          ))}
        </div>
      </div>

      {!cid ? (
        <p className="text-muted text-sm">Чтобы публиковать, выберите страну вверху справа.</p>
      ) : !cur?.officialId ? (
        <p className="text-muted text-sm">В выбранной стране официального аккаунта ещё нет. Создайте его в списке выше.</p>
      ) : (
        <>
          <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-3">
            <p className="text-offwhite font-semibold">Опубликовать от имени VETOKS — {cur.country}</p>
            <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={500} placeholder="Текст анонса" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
            <button onClick={publish} disabled={!file || busy} className="bg-gold text-bgPrimary font-semibold rounded-full px-5 py-2 text-sm self-start disabled:opacity-40">
              {busy ? "Публикуем..." : "Опубликовать"}
            </button>
            <label className="text-muted text-xs">
              Аватар аккаунта: <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setAvatar(e.target.files[0])} />
            </label>
          </div>
          {posts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-muted text-xs">Последние публикации</p>
              {posts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-bgPrimary border border-muted rounded-xl px-3 py-2">
                  <span className="text-lg">{p.media_type === "video" ? "🎬" : "🖼"}</span>
                  <span className="flex-1 text-sm text-offwhite truncate">{p.caption || "Без текста"}</span>
                  <span className="text-muted text-xs">{new Date(p.created_at).toLocaleDateString("ru-RU")}</span>
                  <button
                    onClick={async () => {
                      if (!confirm("Удалить публикацию?")) return;
                      await apiPost("/api/admin/official", { action: "delete", countryId: cid, postId: p.id });
                      loadPosts();
                    }}
                    className="text-danger text-xs"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {msg && <p className="text-offwhite text-sm">{msg}</p>}
    </div>
  );
}
