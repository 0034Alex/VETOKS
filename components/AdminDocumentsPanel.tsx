"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";

const AUD: Record<string, string> = { all: "все", participants: "участницы", partner: "кабинет партнёра" };

// CRM → «Документы»: правка текста с историей версий.
export default function AdminDocumentsPanel() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("all");
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [country, setCountry] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eContent, setEContent] = useState("");
  const [histId, setHistId] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);

  async function load() {
    const r = await apiPost("/api/admin/documents", { action: "list" });
    setDocs(r?.docs ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from("countries").select("id, name").order("name");
      setCountries((data as { id: string; name: string }[]) ?? []);
      setCountry(getCrmCountry());
    })();
  }, []);
  const cname = (id?: string | null) => (id ? countries.find((c) => c.id === id)?.name ?? "страна" : "Стандарт (все страны)");

  const act = async (body: object) => {
    const r = await apiPost("/api/admin/documents", body);
    await load();
    return r;
  };

  async function create() {
    if (!title.trim() || !content.trim()) return;
    const r = await act({ action: "create", title, content, audience, country_id: country || null });
    if (r && r.ok === false) {
      alert(r.message || "Не получилось. Если пишет про колонку — выполните SQL про country_id.");
      return;
    }
    setTitle("");
    setContent("");
    setAudience("all");
  }

  async function save(id: string) {
    await act({ action: "save", id, title: eTitle, content: eContent });
    setEditId(null);
    if (histId === id) openHistory(id);
  }

  async function openHistory(id: string) {
    if (histId === id && versions.length >= 0) {
      /* перезагрузка списка ниже */
    }
    setHistId(id);
    const r = await apiPost("/api/admin/documents", { action: "versions", id });
    setVersions(r?.versions ?? []);
  }

  async function restore(id: string, versionId: string, v: number) {
    if (!confirm(`Вернуть текст версии ${v}? Текущий текст сохранится в истории.`)) return;
    await act({ action: "restore", id, versionId });
    await openHistory(id);
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="max-w-lg">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <p className="text-offwhite text-sm font-semibold mb-2">Новый документ</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название, напр. «Политика конфиденциальности»" className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Текст документа" className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3">
          <option value="all">Все пользователи</option>
          <option value="participants">Только участницы</option>
          <option value="partner">Кабинет партнёра (показывать партнёрам)</option>
        </select>
        <label className="block text-xs text-muted mb-1">Для какой страны этот документ</label>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3">
          <option value="">Стандарт — для всех стран</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted mb-3">Свой документ страны заменяет стандартный с тем же названием. Другие страны его не видят.</p>
        <button onClick={create} disabled={!title.trim() || !content.trim()} className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40">
          Добавить документ
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {docs.map((d) => (
          <div key={d.id} className="bg-bgSurface border border-muted rounded-xl p-4">
            <div className="flex justify-between items-start mb-1">
              <p className="text-offwhite text-sm font-semibold">{d.title}</p>
              <span className="text-muted text-[10px] text-right">
                {cname(d.country_id)} · {AUD[d.audience] ?? d.audience} · версия {d.version ?? 1}
                {d.updated_at ? ` · ${new Date(d.updated_at).toLocaleDateString("ru-RU")}` : ""}
              </span>
            </div>

            {editId === d.id ? (
              <>
                <input value={eTitle} onChange={(e) => setETitle(e.target.value)} className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
                <textarea value={eContent} onChange={(e) => setEContent(e.target.value)} rows={10} className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => save(d.id)} className="bg-gold text-bgPrimary font-semibold px-4 py-1.5 rounded-full text-xs">Сохранить новую версию</button>
                  <button onClick={() => setEditId(null)} className="border border-muted text-offwhite px-3 py-1.5 rounded-full text-xs">Отмена</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted text-xs mb-2 line-clamp-2">{d.content}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setEditId(d.id); setETitle(d.title); setEContent(d.content); }} className="text-xs px-3 py-1 rounded-full border border-gold text-gold">Править</button>
                  <button onClick={() => (histId === d.id ? setHistId(null) : openHistory(d.id))} className="text-xs px-3 py-1 rounded-full border border-muted text-offwhite">История</button>
                  <button onClick={() => act({ action: "toggle", id: d.id, active: !d.is_active })} className={`text-xs px-3 py-1 rounded-full ${d.is_active ? "bg-success text-bgPrimary" : "bg-bgPrimary border border-muted text-muted"}`}>
                    {d.is_active ? "Активен" : "Выключен"}
                  </button>
                  <select
                    value={d.country_id ?? ""}
                    onChange={(e) => act({ action: "set_country", id: d.id, country_id: e.target.value || null })}
                    className="text-xs px-2 py-1 rounded-full bg-bgPrimary border border-muted text-offwhite"
                    title="Для какой страны документ"
                  >
                    <option value="">Стандарт (все страны)</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={(d as any).show_at ?? ""}
                    onChange={(e) => act({ action: "show_at", id: d.id, value: e.target.value })}
                    className="text-xs px-2 py-1 rounded-full bg-bgPrimary border border-gold text-offwhite"
                    title="Где показывать этот документ рядом с галочкой согласия"
                  >
                    <option value="">Не показывать при входе</option>
                    <option value="register">При регистрации</option>
                    <option value="apply">При подаче анкеты</option>
                    <option value="both">В обоих местах</option>
                  </select>
                  <button onClick={() => confirm("Удалить документ вместе с историей?") && act({ action: "delete", id: d.id })} className="text-xs px-3 py-1 rounded-full bg-danger text-bgPrimary">Удалить</button>
                </div>
              </>
            )}

            {histId === d.id && (
              <div className="mt-3 border-t border-muted pt-2">
                <p className="text-muted text-xs mb-1">Прошлые версии</p>
                {versions.length === 0 && <p className="text-muted text-xs">Правок пока не было.</p>}
                {versions.map((v) => (
                  <div key={v.id} className="flex justify-between items-center py-1">
                    <span className="text-offwhite text-xs">Версия {v.version} · {new Date(v.created_at).toLocaleString("ru-RU")}</span>
                    <button onClick={() => restore(d.id, v.id, v.version)} className="text-xs text-gold underline">Вернуть</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
