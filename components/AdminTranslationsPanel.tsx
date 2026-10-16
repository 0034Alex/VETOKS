"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { ALL_LANGS, LANG_LABELS } from "@/lib/langs";

// CRM → «Переводы»: автопереводы текстов из CRM. Можно поправить или удалить —
// удалённый перевод при следующем показе сделается заново.
type Row = { lang: string; h: string; src: string; text: string; manual: boolean };

export default function AdminTranslationsPanel() {
  const [lang, setLang] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await apiPost("/api/admin/translations", { action: "list", lang, query: q });
    if (r?.ok) {
      setRows(r.items);
      setMsg(r.items.length ? "" : "Пока пусто — переводы появятся, когда пользователи других языков откроют тексты из CRM.");
    } else setMsg(r?.error === "no_table" ? "Нужно выполнить SQL для таблицы переводов." : "Не получилось загрузить.");
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function save(r: Row) {
    const text = edit[r.lang + r.h];
    if (!text) return;
    const res = await apiPost("/api/admin/translations", { action: "save", lang: r.lang, h: r.h, text });
    if (res?.ok) {
      setRows((a) => a.map((x) => (x.lang === r.lang && x.h === r.h ? { ...x, text, manual: true } : x)));
      setEdit((e) => {
        const n = { ...e };
        delete n[r.lang + r.h];
        return n;
      });
    }
  }
  async function del(r: Row) {
    const res = await apiPost("/api/admin/translations", { action: "delete", lang: r.lang, h: r.h });
    if (res?.ok) setRows((a) => a.filter((x) => !(x.lang === r.lang && x.h === r.h)));
  }

  return (
    <div className="max-w-2xl">
      <p className="text-muted text-xs mb-3">
        Здесь автопереводы текстов, которые вы вводите в CRM (задания, названия подарков, регионы и т.д.). Исходный текст — как вы его написали. Поправленный вручную перевод больше не перезаписывается.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm">
          <option value="">Все языки</option>
          {ALL_LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_LABELS[l]}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Поиск по тексту"
          className="flex-1 min-w-[160px] bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={load} className="bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm">
          Найти
        </button>
      </div>
      {msg && <p className="text-muted text-sm mb-3">{msg}</p>}
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const k = r.lang + r.h;
          const val = edit[k] ?? r.text;
          return (
            <div key={k} className="bg-bgSurface border border-muted rounded-xl p-3">
              <p className="text-muted text-xs mb-1">
                {LANG_LABELS[r.lang as keyof typeof LANG_LABELS] ?? r.lang}
                {r.manual && <span className="text-gold"> · правлено вручную</span>}
              </p>
              <p className="text-offwhite text-sm mb-2">{r.src}</p>
              <textarea
                value={val}
                onChange={(e) => setEdit((x) => ({ ...x, [k]: e.target.value }))}
                rows={2}
                className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => save(r)}
                  disabled={edit[k] == null || edit[k] === r.text}
                  className="bg-gold text-bgPrimary font-semibold px-4 py-1.5 rounded-full text-xs disabled:opacity-40"
                >
                  Сохранить
                </button>
                <button onClick={() => del(r)} className="border border-muted text-muted px-4 py-1.5 rounded-full text-xs">
                  Удалить (переведётся заново)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
