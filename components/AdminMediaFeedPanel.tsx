"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

type Theme = { id: string; title: string; kind: string; starts_at: string; ends_at: string; country_id: string | null };
type Item = { id: string; name: string; caption: string; at: string; impressions: number; qualified: number; completes: number; likes: number; comments: number; weight: number; pinned: boolean; hidden: boolean };

const loc = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const show = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// CRM → «Лента»: темы с датами (любой длины), статистика по роликам, закрепить/скрыть, квота показов.
export default function AdminMediaFeedPanel() {
  const cid = typeof window !== "undefined" ? getCrmCountry() : "";
  const [themes, setThemes] = useState<Theme[]>([]);
  const [viewers, setViewers] = useState(0);
  const [qMin, setQMin] = useState("");
  const [qMax, setQMax] = useState("");
  const [form, setForm] = useState<{ id?: string; title: string; kind: string; starts: string; ends: string }>({ title: "", kind: "theme", starts: "", ends: "" });
  const [sel, setSel] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiPost("/api/admin/media-feed", { action: "overview", country_id: cid });
    if (!r?.ok) return setMsg("Не удалось загрузить. Проверьте, что SQL для ленты выполнен.");
    setThemes(r.themes ?? []);
    setViewers(r.viewers24 ?? 0);
    setQMin(r.settings?.media_quota_min ?? "");
    setQMax(r.settings?.media_quota_max ?? "");
  }, [cid]);

  const loadItems = useCallback(async (t: string) => {
    const r = await apiPost("/api/admin/media-feed", { action: "stats", country_id: cid, theme_id: t });
    setItems(r?.items ?? []);
  }, [cid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadItems(sel); }, [sel, loadItems]);

  function quick(days: number) {
    const s = form.starts ? new Date(form.starts) : new Date();
    const e = new Date(s.getTime() + days * 86400000);
    setForm({ ...form, starts: loc(s.toISOString()), ends: loc(e.toISOString()) });
  }

  async function save() {
    if (!form.title.trim() || !form.starts || !form.ends) return setMsg("Заполните название и даты");
    setBusy(true);
    const r = await apiPost("/api/admin/media-feed", { action: "theme_save", country_id: cid, id: form.id, title: form.title, kind: form.kind, starts_at: new Date(form.starts).toISOString(), ends_at: new Date(form.ends).toISOString() });
    setBusy(false);
    if (!r?.ok) return setMsg("Не сохранилось: проверьте даты (конец позже начала)");
    setForm({ title: "", kind: "theme", starts: "", ends: "" });
    setMsg("Тема сохранена");
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить тему? Ролики останутся, но потеряют привязку к теме.")) return;
    await apiPost("/api/admin/media-feed", { action: "theme_delete", id });
    load();
  }

  async function flag(id: string, patch: { pinned?: boolean; hidden?: boolean }) {
    await apiPost("/api/admin/media-feed", { action: "flag", post_id: id, ...patch });
    loadItems(sel);
  }

  async function saveSettings() {
    await apiPost("/api/admin/media-feed", { action: "settings_save", country_id: cid, media_quota_min: qMin, media_quota_max: qMax });
    setMsg("Настройки сохранены");
  }

  async function rebuild() {
    if (!cid) return setMsg("Выберите страну в верхней строке CRM");
    setBusy(true);
    setMsg("Пересобираю ленту…");
    const r = await apiPost("/api/admin/media-feed", { action: "rebuild", country_id: cid });
    setBusy(false);
    setMsg(r?.ok ? `Готово. Роликов в пуле: ${r.rows}. Сейчас идёт тема: ${r.active ?? "нет (лента без темы)"}` : `Ошибка: ${r?.error ?? "не получилось"}`);
    loadItems(sel);
  }

  const now = Date.now();
  const state = (t: Theme) => (now < +new Date(t.starts_at) ? "скоро" : now > +new Date(t.ends_at) ? "завершена" : "идёт");

  return (
    <div className="space-y-5">
      <div className="bg-bgSurface rounded-xl p-4">
        <h2 className="text-offwhite font-semibold mb-1">Лента «Медиа»</h2>
        <p className="text-muted text-xs">
          Зрителей за сутки: <b className="text-gold">{viewers}</b>. Новые ролики получают честный старт: чем меньше показов, тем раньше показ. Дальше лента сама поднимает то, что досматривают, лайкают и комментируют.
          {!cid && " Страна не выбрана — темы будут общими для всех стран."}
        </p>
        <button onClick={rebuild} disabled={busy} className="mt-3 px-4 py-2 rounded-full border border-gold text-gold text-sm disabled:opacity-40">Пересобрать ленту сейчас</button>
        {msg && <p className="text-gold text-xs mt-2">{msg}</p>}
      </div>

      <div className="bg-bgSurface rounded-xl p-4">
        <h3 className="text-offwhite font-semibold mb-2">Темы</h3>
        <p className="text-muted text-xs mb-3">Тема — это отрезок времени (любой длины), в который ролики идут в ленте вместе. Загруженный ролик попадает в тему, которая идёт сейчас, а если паузы — в ближайшую следующую.</p>
        {themes.length === 0 && <p className="text-muted text-sm mb-2">Тем пока нет. Без темы лента показывает ролики без привязки к этапу.</p>}
        {themes.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 border-t border-muted/30 py-2">
            <div className="min-w-0">
              <p className="text-offwhite text-sm truncate">{t.title} {t.kind === "casting" && <span className="text-gold text-[10px]">· отбор</span>}</p>
              <p className="text-muted text-xs">{show(t.starts_at)} — {show(t.ends_at)} · <span className={state(t) === "идёт" ? "text-gold" : ""}>{state(t)}</span></p>
            </div>
            <div className="flex gap-2 flex-none text-xs">
              <button onClick={() => setSel(t.id)} className="text-gold">Ролики</button>
              <button onClick={() => setForm({ id: t.id, title: t.title, kind: t.kind, starts: loc(t.starts_at), ends: loc(t.ends_at) })} className="text-muted">Изменить</button>
              <button onClick={() => remove(t.id)} className="text-danger">✕</button>
            </div>
          </div>
        ))}

        <div className="mt-3 border-t border-muted/30 pt-3 space-y-2">
          <p className="text-offwhite text-sm font-semibold">{form.id ? "Изменить тему" : "Новая тема"}</p>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название, например «Танец дня»" maxLength={80} className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-muted text-xs">Начало<input type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} className="w-full bg-bgPrimary border border-muted rounded-lg px-2 py-2 text-sm text-offwhite" /></label>
            <label className="text-muted text-xs">Конец<input type="datetime-local" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} className="w-full bg-bgPrimary border border-muted rounded-lg px-2 py-2 text-sm text-offwhite" /></label>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {[1, 2, 3, 5, 7].map((d) => (
              <button key={d} onClick={() => quick(d)} className="px-3 py-1 rounded-full border border-muted text-offwhite text-xs">{d} дн.</button>
            ))}
            <label className="flex items-center gap-1 text-offwhite text-xs ml-auto">
              <input type="checkbox" checked={form.kind === "casting"} onChange={(e) => setForm({ ...form, kind: e.target.checked ? "casting" : "theme" })} /> Отбор (видео-прослушивание)
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-40">Сохранить</button>
            {form.id && <button onClick={() => setForm({ title: "", kind: "theme", starts: "", ends: "" })} className="text-muted text-sm px-3">Отмена</button>}
          </div>
        </div>
      </div>

      <div className="bg-bgSurface rounded-xl p-4">
        <h3 className="text-offwhite font-semibold mb-2">Квота честного старта</h3>
        <p className="text-muted text-xs mb-2">Сколько показов гарантировано каждому новому ролику. Считается автоматически от числа зрителей; здесь границы. Обычно 20 и 300.</p>
        <div className="flex gap-2 items-center">
          <input value={qMin} onChange={(e) => setQMin(e.target.value)} placeholder="минимум (20)" inputMode="numeric" className="w-32 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
          <input value={qMax} onChange={(e) => setQMax(e.target.value)} placeholder="максимум (300)" inputMode="numeric" className="w-32 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
          <button onClick={saveSettings} className="px-4 py-2 rounded-full border border-gold text-gold text-sm">Сохранить</button>
        </div>
      </div>

      <div className="bg-bgSurface rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-offwhite font-semibold">Ролики {sel ? "темы" : "(все)"}</h3>
          {sel && <button onClick={() => setSel("")} className="text-muted text-xs">Показать все</button>}
        </div>
        <p className="text-muted text-xs mb-2">Показы · досмотры (более 10 с) · до конца · лайки · комментарии · вес в ленте. 📌 — всегда наверху, 🚫 — убрать из ленты (в профиле остаётся).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-offwhite min-w-[560px]">
            <thead>
              <tr className="text-muted text-left">
                <th className="py-1">Участница</th><th>Показы</th><th>10с+</th><th>Конец</th><th>♥</th><th>💬</th><th>Вес</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={`border-t border-muted/30 ${i.hidden ? "opacity-40" : ""}`}>
                  <td className="py-1.5 pr-2"><span className="block truncate max-w-[160px]">{i.name}</span><span className="text-muted text-[10px] block">{show(i.at)}</span></td>
                  <td>{i.impressions}</td><td>{i.qualified}</td><td>{i.completes}</td><td>{i.likes}</td><td>{i.comments}</td><td>{i.weight.toFixed(2)}</td>
                  <td className="whitespace-nowrap">
                    <button onClick={() => flag(i.id, { pinned: !i.pinned })} className={i.pinned ? "text-gold" : "text-muted"}>📌</button>{" "}
                    <button onClick={() => flag(i.id, { hidden: !i.hidden })} className={i.hidden ? "text-danger" : "text-muted"}>🚫</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} className="text-muted py-3">Роликов нет</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
