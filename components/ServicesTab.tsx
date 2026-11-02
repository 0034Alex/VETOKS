"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { cleanImage } from "@/lib/imageClean";
import { money } from "@/lib/businessShared";

const DAYS: [number, string][] = [[1, "Пн"], [2, "Вт"], [3, "Ср"], [4, "Чт"], [5, "Пт"], [6, "Сб"], [7, "Вс"]];
const DURS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const ERR: Record<string, string> = {
  empty_name: "Введите название.",
  bad_time: "Проверьте время работы: конец должен быть позже начала.",
  bad_price: "Проверьте цену.",
  bad_duration: "Выберите длительность.",
  need_sql: "Раздел ещё настраивается.",
};
const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 === 0 ? `${m / 60} ч` : `${Math.floor(m / 60)} ч ${m % 60} мин`);
const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";

// Услуги и мастера бизнеса: расписание каждого мастера, длительность и цена услуг.
export default function ServicesTab({ cur, userId }: { cur: string; userId: string }) {
  const [cat, setCat] = useState<{ masters: any[]; services: any[] } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [mEdit, setMEdit] = useState<any>(null);
  const [sEdit, setSEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [off, setOff] = useState("");

  async function load() {
    const r = await apiPost("/api/business/services", { action: "list" });
    if (r?.unavailable) setUnavailable(true);
    setCat(r?.ok && !r.unavailable ? { masters: r.masters, services: r.services } : { masters: [], services: [] });
  }
  useEffect(() => {
    load();
  }, []);

  async function save(action: string, body: any, close: () => void) {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/services", { action, ...body });
    setBusy(false);
    if (r?.ok) {
      setCat({ masters: r.masters, services: r.services });
      close();
    } else setMsg(ERR[r?.error] ?? "Не получилось сохранить. Попробуйте ещё раз.");
  }

  async function uploadPhoto(file: File) {
    setMsg("");
    try {
      const up = await cleanImage(file);
      const path = `${userId}-${Date.now()}-master.${(up.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, up);
      if (error) return setMsg("Ошибка загрузки: " + error.message);
      const { data } = supabase.storage.from("participant-photos").getPublicUrl(path);
      setMEdit((m: any) => ({ ...m, photo_url: data.publicUrl }));
    } catch (e: any) {
      setMsg(e?.message || "Не удалось обработать фото.");
    }
  }

  if (!cat) return <p className="text-muted text-sm">Загрузка...</p>;
  if (unavailable) return <p className="text-muted text-sm">Раздел ещё настраивается. Попробуйте позже.</p>;

  if (mEdit) {
    const m = mEdit;
    const toggleDay = (n: number) => setMEdit({ ...m, work_days: m.work_days.includes(n) ? m.work_days.filter((x: number) => x !== n) : [...m.work_days, n] });
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => { setMEdit(null); setMsg(""); }} className="text-muted text-sm self-start">← Назад</button>
        <p className="text-offwhite font-semibold">{m.id ? "Мастер" : "Новый мастер"}</p>
        <div className="flex items-center gap-3">
          <span className="w-16 h-16 rounded-full overflow-hidden bg-bgSurface border border-gold/40 flex items-center justify-center text-gold font-bold flex-none">
            {m.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (m.name || "?").slice(0, 1).toUpperCase()
            )}
          </span>
          <label className="border border-gold text-gold rounded-full px-4 py-2 text-sm cursor-pointer">
            Загрузить фото
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </label>
        </div>
        <input value={m.name} onChange={(e) => setMEdit({ ...m, name: e.target.value })} placeholder="Имя мастера" maxLength={60} className={input} />
        <input value={m.role} onChange={(e) => setMEdit({ ...m, role: e.target.value })} placeholder="Должность (например, топ-стилист)" maxLength={60} className={input} />
        <div>
          <p className="text-muted text-xs mb-1">Рабочие дни</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS.map(([n, l]) => (
              <button key={n} onClick={() => toggleDay(n)} className={`w-11 py-1.5 rounded-lg border text-sm ${m.work_days.includes(n) ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-muted text-xs flex flex-col gap-1">С<input type="time" value={m.start_time} onChange={(e) => setMEdit({ ...m, start_time: e.target.value })} className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">До<input type="time" value={m.end_time} onChange={(e) => setMEdit({ ...m, end_time: e.target.value })} className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Шаг записи
            <select value={m.slot_min} onChange={(e) => setMEdit({ ...m, slot_min: Number(e.target.value) })} className={input}>
              {[15, 20, 30, 45, 60, 90, 120].map((x) => <option key={x} value={x}>{x} мин</option>)}
            </select>
          </label>
        </div>
        <div>
          <p className="text-muted text-xs mb-1">Выходные и отпуск (отдельные даты)</p>
          <div className="flex gap-2">
            <input type="date" value={off} onChange={(e) => setOff(e.target.value)} className={input} />
            <button onClick={() => { if (off && !m.days_off.includes(off)) setMEdit({ ...m, days_off: [...m.days_off, off].sort() }); setOff(""); }} className="border border-gold text-gold rounded-lg px-3 text-sm flex-none">Добавить</button>
          </div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {m.days_off.map((d: string) => (
              <button key={d} onClick={() => setMEdit({ ...m, days_off: m.days_off.filter((x: string) => x !== d) })} className="text-xs border border-muted text-offwhite rounded-full px-2.5 py-1">{d.slice(8, 10)}.{d.slice(5, 7)}.{d.slice(0, 4)} ×</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={m.is_active} onChange={(e) => setMEdit({ ...m, is_active: e.target.checked })} />Принимает записи</label>
        {msg && <p className="text-danger text-xs">{msg}</p>}
        <button disabled={busy} onClick={() => save("master_save", m, () => setMEdit(null))} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить мастера"}</button>
      </div>
    );
  }

  if (sEdit) {
    const x = sEdit;
    const toggleM = (id: string) => setSEdit({ ...x, master_ids: x.master_ids.includes(id) ? x.master_ids.filter((y: string) => y !== id) : [...x.master_ids, id] });
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => { setSEdit(null); setMsg(""); }} className="text-muted text-sm self-start">← Назад</button>
        <p className="text-offwhite font-semibold">{x.id ? "Услуга" : "Новая услуга"}</p>
        <input value={x.name} onChange={(e) => setSEdit({ ...x, name: e.target.value })} placeholder="Название (например, сложное окрашивание)" maxLength={100} className={input} />
        <input value={x.category} onChange={(e) => setSEdit({ ...x, category: e.target.value })} placeholder="Раздел (волосы, ногти, макияж)" maxLength={60} className={input} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-muted text-xs flex flex-col gap-1">Цена, {cur}<input value={x.price} onChange={(e) => setSEdit({ ...x, price: e.target.value })} inputMode="decimal" className={input} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Длительность
            <select value={x.duration_min} onChange={(e) => setSEdit({ ...x, duration_min: Number(e.target.value) })} className={input}>
              {DURS.map((d) => <option key={d} value={d}>{dur(d)}</option>)}
            </select>
          </label>
        </div>
        <textarea value={x.description} onChange={(e) => setSEdit({ ...x, description: e.target.value })} placeholder="Описание (необязательно)" rows={2} maxLength={600} className={input} />
        <div>
          <p className="text-muted text-xs mb-1">Кто выполняет (если никого не отметить, то все мастера)</p>
          {cat.masters.length === 0 && <p className="text-muted text-xs">Сначала добавьте мастеров.</p>}
          <div className="flex flex-col gap-1.5">
            {cat.masters.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={x.master_ids.includes(m.id)} onChange={() => toggleM(m.id)} />{m.name}{m.is_active ? "" : " (не принимает)"}</label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={x.is_active} onChange={(e) => setSEdit({ ...x, is_active: e.target.checked })} />Показывать клиентам</label>
        {msg && <p className="text-danger text-xs">{msg}</p>}
        <button disabled={busy} onClick={() => save("service_save", x, () => setSEdit(null))} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить услугу"}</button>
      </div>
    );
  }

  const newMaster = { name: "", role: "", photo_url: null, work_days: [1, 2, 3, 4, 5], start_time: "10:00", end_time: "19:00", slot_min: 30, days_off: [], is_active: true };
  const newService = { name: "", category: "", price: "", duration_min: 60, description: "", master_ids: [], is_active: true };
  const dayText = (d: number[]) => DAYS.filter(([n]) => d.includes(n)).map(([, l]) => l).join(", ") || "нет рабочих дней";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-offwhite font-semibold text-sm">Мастера</p>
        <button onClick={() => setMEdit(newMaster)} className="bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">＋ Добавить мастера</button>
        {cat.masters.length === 0 && <p className="text-muted text-xs">Добавьте мастеров и их график, и клиенты смогут записываться на свободное время.</p>}
        {cat.masters.map((m) => (
          <button key={m.id} onClick={() => setMEdit({ ...m })} className={`text-left bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3 ${m.is_active ? "" : "opacity-60"}`}>
            <span className="w-11 h-11 rounded-full overflow-hidden bg-bgPrimary border border-gold/40 flex items-center justify-center text-gold font-bold flex-none">
              {m.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                m.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-offwhite text-sm font-semibold break-words">{m.name}{m.role ? ` · ${m.role}` : ""}</span>
              <span className="block text-muted text-xs">{dayText(m.work_days)} · {m.start_time}–{m.end_time}{m.is_active ? "" : " · скрыт"}</span>
            </span>
            <span className="text-gold">›</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-offwhite font-semibold text-sm">Услуги</p>
        <button onClick={() => setSEdit(newService)} className="bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">＋ Добавить услугу</button>
        {cat.services.length === 0 && <p className="text-muted text-xs">Добавьте услуги с ценой и длительностью.</p>}
        {cat.services.map((s) => (
          <button key={s.id} onClick={() => setSEdit({ ...s })} className={`text-left bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3 ${s.is_active ? "" : "opacity-60"}`}>
            <span className="min-w-0 flex-1">
              <span className="block text-offwhite text-sm font-semibold break-words">{s.name}</span>
              <span className="block text-muted text-xs">{s.category ? `${s.category} · ` : ""}{dur(s.duration_min)} · {s.master_ids.length ? `мастеров: ${s.master_ids.length}` : "все мастера"}{s.is_active ? "" : " · скрыта"}</span>
            </span>
            <span className="text-gold text-sm font-bold flex-none">{money(s.price, cur)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
