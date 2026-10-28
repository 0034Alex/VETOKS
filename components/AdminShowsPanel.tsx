"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { THEME_KEYS, THEME_PRESETS, type ShowTheme } from "@/lib/showTheme";

type Show = {
  id?: string;
  key: string;
  title: string;
  contest: string;
  status: string;
  theme: ShowTheme;
  apply_open_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  preview_token?: string | null;
  banner?: { image?: string; title?: string; subtitle?: string; stage_label?: string; countdown_to?: string | null; apply?: boolean; apply_until?: string | null; poll_question?: string };
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  scheduled: "Запланировано",
  live: "Идёт",
  finished: "Закончено",
};

function toLocal(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const empty = (): Show => ({ key: "", title: "", contest: "", status: "draft", theme: {}, apply_open_at: null, starts_at: null, ends_at: null, banner: {} });

export default function AdminShowsPanel() {
  const [items, setItems] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<Show | null>(null);

  async function load() {
    setLoading(true);
    const r = await apiPost("/api/admin/shows", { action: "list" });
    setItems(r?.items ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 3000);
  }

  async function save(s: Show) {
    const r = await apiPost("/api/admin/shows", { action: "save", ...s });
    if (!r?.ok) return flash(r?.message || "Не получилось сохранить.");
    flash("Сохранено!");
    setDraft(null);
    load();
  }

  async function newToken(id: string) {
    const r = await apiPost("/api/admin/shows", { action: "token", id });
    if (r?.ok) {
      flash("Старая ссылка больше не работает.");
      load();
    }
  }

  async function remove(id: string) {
    const r = await apiPost("/api/admin/shows", { action: "delete", id });
    if (!r?.ok) return flash(r?.message || "Не получилось удалить.");
    load();
  }

  async function uploadBanner(file: File, set: (url: string) => void) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `show-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("stage-banners").upload(path, file);
    if (error) return flash("Ошибка загрузки: " + error.message);
    set(supabase.storage.from("stage-banners").getPublicUrl(path).data.publicUrl);
  }

  function previewMe(id: string) {
    try {
      localStorage.setItem("vt_preview_id", id);
      localStorage.removeItem("vt_preview_token");
    } catch {}
    window.open("/", "_blank");
  }

  async function copyLink(token: string | null | undefined) {
    if (!token) return flash("Сначала сохраните шоу.");
    const url = `${window.location.origin}/?show_preview=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Ссылка скопирована.");
    } catch {
      window.prompt("Скопируйте ссылку:", url);
    }
  }

  function Card({ s, onChange, isNew }: { s: Show; onChange: (v: Show) => void; isNew: boolean }) {
    const th = s.theme ?? {};
    const col = (k: keyof ShowTheme, def: string) => th[k] || def;
    const inp = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-full";
    return (
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            Название
            <input className={inp} value={s.title} onChange={(e) => onChange({ ...s, title: e.target.value })} placeholder="Шоу талантов" />
          </label>
          <label className="text-xs text-muted">
            Статус
            <select className={inp} value={s.status} onChange={(e) => onChange({ ...s, status: e.target.value })}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-muted">
            Открыть набор анкет
            <input type="datetime-local" className={inp} value={toLocal(s.apply_open_at)} onChange={(e) => onChange({ ...s, apply_open_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </label>
          <label className="text-xs text-muted">
            Старт шоу
            <input type="datetime-local" className={inp} value={toLocal(s.starts_at)} onChange={(e) => onChange({ ...s, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </label>
          <label className="text-xs text-muted">
            Конец шоу
            <input type="datetime-local" className={inp} value={toLocal(s.ends_at)} onChange={(e) => onChange({ ...s, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </label>
        </div>
        <p className="text-muted text-xs">
          Время по вашему часовому поясу. Статус «Запланировано» + дата старта: в эту минуту приложение само переключится на это шоу.
        </p>

        <div>
          <p className="text-xs text-muted mb-2">Цвета шоу</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(THEME_PRESETS).map(([k, p]) => (
              <button key={k} onClick={() => onChange({ ...s, theme: { ...p.theme } })} className="text-xs border border-muted rounded-full px-3 py-1.5 text-offwhite">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEME_KEYS.map((t) => (
              <label key={t.key} className="text-xs text-muted flex items-center gap-2">
                <input
                  type="color"
                  value={col(t.key, t.def)}
                  onChange={(e) => onChange({ ...s, theme: { ...th, [t.key]: e.target.value } })}
                  className="w-9 h-9 rounded border border-muted bg-transparent flex-none"
                />
                <span className="min-w-0">{t.label}</span>
              </label>
            ))}
          </div>
          <div
            className="mt-3 rounded-xl p-3 border"
            style={{ background: col("bg", "#0B0B0D"), borderColor: col("gold", "#C9A227") }}
          >
            <div className="rounded-lg p-3" style={{ background: col("surface", "#161618") }}>
              <p className="text-sm font-semibold" style={{ color: col("gold", "#C9A227") }}>Так будет выглядеть акцент</p>
              <div className="h-2 rounded-full my-2" style={{ background: `linear-gradient(90deg, ${col("sec", "#7C3AED")}, ${col("gold", "#C9A227")})` }} />
              <span className="inline-block text-xs rounded-full px-4 py-1.5 font-semibold" style={{ background: col("gold", "#C9A227"), color: col("bg", "#0B0B0D") }}>Голосовать</span>
              <span className="inline-block text-xs rounded-full px-4 py-1.5 ml-2 text-white" style={{ background: `linear-gradient(90deg, ${col("sec", "#7C3AED")}, ${col("sec2", "#EC4899")})` }}>Баннер</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Главный баннер на главной странице шоу</p>
          {(() => {
            const bn = s.banner ?? {};
            const setB = (p: Partial<NonNullable<Show["banner"]>>) => onChange({ ...s, banner: { ...bn, ...p } });
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-28 h-16 rounded-lg overflow-hidden bg-bgPrimary border border-muted flex-none">
                    {bn.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bn.image} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <label className="border border-gold text-gold text-xs rounded-full px-4 py-2 cursor-pointer">
                    Загрузить картинку
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadBanner(f, (u) => setB({ image: u })); }} />
                  </label>
                  {bn.image && (
                    <button onClick={() => setB({ image: "" })} className="text-muted text-xs">убрать</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-muted">Заголовок<input className={inp} value={bn.title ?? ""} onChange={(e) => setB({ title: e.target.value })} placeholder="Шоу талантов" /></label>
                  <label className="text-xs text-muted">Подпись<input className={inp} value={bn.subtitle ?? ""} onChange={(e) => setB({ subtitle: e.target.value })} placeholder="Сцена. Голос. Победа." /></label>
                  <label className="text-xs text-muted">Этап (надпись)<input className={inp} value={bn.stage_label ?? ""} onChange={(e) => setB({ stage_label: e.target.value })} placeholder="Этап 1 · Отбор" /></label>
                  <label className="text-xs text-muted sm:col-span-2">Приём анкет до (после этого срока кнопка «Подать анкету» исчезает с баннера и главной)<input type="datetime-local" className={inp} value={toLocal(bn.apply_until ?? null)} onChange={(e) => setB({ apply_until: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
                  <label className="text-xs text-muted sm:col-span-2">Вопрос опроса на главной (смена вопроса запускает новый опрос)<input className={inp} value={bn.poll_question ?? ""} onChange={(e) => setB({ poll_question: e.target.value })} placeholder="Кто лучше всех выступил на этой неделе?" maxLength={200} /></label>
                  <label className="text-xs text-muted">Конец этапа (обратный отсчёт)<input type="datetime-local" className={inp} value={toLocal(bn.countdown_to ?? null)} onChange={(e) => setB({ countdown_to: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
                </div>
                <label className="text-xs text-muted flex items-center gap-2">
                  <input type="checkbox" checked={bn.apply !== false} onChange={(e) => setB({ apply: e.target.checked })} />
                  Показывать кнопку «Подать анкету»
                </label>
              </div>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => save(s)} className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm">
            Сохранить
          </button>
          {isNew && (
            <button onClick={() => setDraft(null)} className="text-muted text-sm px-3 py-2">
              Отмена
            </button>
          )}
          {!isNew && s.id && (
            <>
              <button onClick={() => previewMe(s.id!)} className="border border-gold text-gold px-4 py-2 rounded-full text-sm">
                👁 Открыть для теста
              </button>
              <button onClick={() => copyLink(s.preview_token)} className="border border-muted text-offwhite px-4 py-2 rounded-full text-sm">
                🔗 Ссылка для теста
              </button>
              <button onClick={() => newToken(s.id!)} className="text-muted text-xs px-2 py-2">
                сбросить ссылку
              </button>
              {s.status === "draft" && (
                <button onClick={() => remove(s.id!)} className="text-danger text-xs px-2 py-2 ml-auto">
                  Удалить
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <p className="text-muted text-xs">
        Здесь создаются шаблоны шоу: название, цвета, баннер. «Открыть для теста» показывает вам приложение так, как будто это шоу идёт, со всеми блоками и функциями.
        Видите только вы в этом браузере, зрители ничего не замечают. «Ссылка для теста» открывает то же самое любому, кому вы её отправите. Выйти из теста можно кнопкой «выйти» вверху страницы.
        Когда и в какой стране шоу идёт, задаётся в разделе «Страны и запуск».
      </p>
      {msg && <p className="text-success text-sm">{msg}</p>}

      {items.length === 0 && (
        <p className="text-muted text-sm">
          Шоу пока нет. Создайте первое (например Miss, статус «Идёт») и второе (Таланты, статус «Черновик»).
        </p>
      )}

      {items.map((s) => (
        <div key={s.id}>
          <p className="text-offwhite font-semibold mb-2">
            {s.title} <span className="text-muted text-xs font-normal">· {STATUS_LABEL[s.status] ?? s.status}</span>
          </p>
          {Card({ s, isNew: false, onChange: (v) => setItems((a) => a.map((x) => (x.id === v.id ? v : x))) })}
        </div>
      ))}

      {draft ? (
        <div>
          <p className="text-offwhite font-semibold mb-2">Новое шоу</p>
          {Card({ s: draft, isNew: true, onChange: setDraft })}
        </div>
      ) : (
        <button onClick={() => setDraft(empty())} className="self-start border border-gold text-gold px-5 py-2 rounded-full text-sm">
          + Новое шоу
        </button>
      )}
    </div>
  );
}
