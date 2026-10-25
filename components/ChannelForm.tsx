"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { cleanImage } from "@/lib/imageClean";
import { getCurrentUser } from "@/lib/currentUser";

const ERR: Record<string, string> = {
  bad_name: "Название слишком короткое.",
  bad_slug: "Ссылка: 3–32 символа, латиница, цифры и «_».",
  slug_taken: "Такая ссылка уже занята.",
  bad_words: "В тексте есть недопустимые слова.",
  nsfw: "Это фото не прошло проверку.",
  bad_file: "Не удалось принять фото.",
  new_account_limit: "Новый аккаунт может создать только один канал. Попробуйте через сутки.",
  kind_limit: "У вас уже есть канал такого вида. Можно один открытый и один закрытый, скрытых — сколько угодно.",
  rate_limited: "Слишком много попыток. Подождите немного.",
  teen_blocked: "Каналы пока недоступны для этого аккаунта.",
};

const KINDS = [
  { k: "open", t: "Открытый", d: "Канал виден в профиле, подписаться может любой." },
  { k: "closed", t: "Закрытый", d: "Виден в профиле, подписка — по вашему одобрению." },
  { k: "hidden", t: "Скрытый", d: "Нигде не виден, вы приглашаете людей сами." },
];

export default function ChannelForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [descr, setDescr] = useState("");
  const [kind, setKind] = useState("open");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const [err, setErr] = useState("");
  const [slugState, setSlugState] = useState<"" | "ok" | "bad">("");
  const [loading, setLoading] = useState(!!editId);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const r = await apiPost("/api/channels", { action: "get", key: editId });
      if (r?.ok && r.me === "owner") {
        setName(r.channel.name); setSlug(r.channel.slug); setDescr(r.channel.descr); setKind(r.channel.kind); setPhoto(r.channel.photo);
      } else router.replace("/chats");
      setLoading(false);
    })();
  }, [editId, router]);

  useEffect(() => {
    if (editId || !slug) { setSlugState(""); return; }
    const t = setTimeout(async () => {
      const r = await apiPost("/api/channels", { action: "slug_check", slug });
      setSlugState(r?.available ? "ok" : "bad");
    }, 400);
    return () => clearTimeout(t);
  }, [slug, editId]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    setUpl(true); setErr("");
    try {
      const u = await getCurrentUser();
      const fc = await cleanImage(f);
      const ext = (fc.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${u?.id}-${Date.now()}-ch.${ext}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, fc);
      if (error) throw new Error(error.message);
      setPhoto(supabase.storage.from("participant-photos").getPublicUrl(path).data.publicUrl);
    } catch (x: any) {
      setErr(x?.message || "Ошибка загрузки");
    }
    setUpl(false);
  }

  async function save() {
    setBusy(true); setErr("");
    const r = editId
      ? await apiPost("/api/channels", { action: "update", id: editId, name, descr, kind, photo })
      : await apiPost("/api/channels", { action: "create", name, slug, descr, kind, photo });
    setBusy(false);
    if (r?.ok) router.replace(`/channels/${editId || r.channel.id}`);
    else setErr(r?.message || ERR[r?.error] || "Не удалось сохранить.");
  }

  if (loading) return null;
  const input = "w-full bg-bgSurface border border-muted rounded-xl px-4 py-3 text-offwhite text-sm outline-none focus:border-gold";
  return (
    <div className="px-6 flex flex-col gap-4 max-w-md mx-auto">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => file.current?.click()} className="w-20 h-20 rounded-full bg-bgSurface border border-muted bg-cover bg-center text-muted text-xs flex items-center justify-center" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
          {!photo && (upl ? "…" : "Фото")}
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
        <input className={input} placeholder="Название канала" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {!editId && (
        <div>
          <div className="flex items-center bg-bgSurface border border-muted rounded-xl px-4 py-3 text-sm">
            <span className="text-muted">vetoks.com/c/</span>
            <input className="flex-1 bg-transparent outline-none text-offwhite" placeholder="ссылка" maxLength={32} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
          </div>
          {slugState && <p className={`text-xs mt-1 ${slugState === "ok" ? "text-gold" : "text-danger"}`}>{slugState === "ok" ? "Ссылка свободна." : "Ссылка занята или не подходит."}</p>}
        </div>
      )}
      <textarea className={input} rows={3} maxLength={500} placeholder="Описание канала" value={descr} onChange={(e) => setDescr(e.target.value)} />
      <div className="flex flex-col gap-2">
        {KINDS.map((x) => (
          <label key={x.k} className={`border rounded-xl p-3 cursor-pointer ${kind === x.k ? "border-gold bg-bgSurface" : "border-muted"}`}>
            <input type="radio" className="mr-2" checked={kind === x.k} onChange={() => setKind(x.k)} />
            <span className="text-offwhite text-sm font-semibold">{x.t}</span>
            <p className="text-muted text-xs mt-1">{x.d}</p>
          </label>
        ))}
      </div>
      {err && <p className="text-danger text-sm">{err}</p>}
      <button disabled={busy || upl || name.trim().length < 2 || (!editId && slugState !== "ok")} onClick={save} className="rounded-full bg-gold text-black font-semibold py-3 disabled:opacity-40">
        {busy ? "Сохраняем…" : editId ? "Сохранить" : "Создать канал"}
      </button>
    </div>
  );
}
