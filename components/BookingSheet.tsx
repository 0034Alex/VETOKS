"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { money } from "@/lib/businessShared";

type Svc = { id: string; name: string; category: string; price: number; duration_min: number; description: string; master_ids: string[] };
type Mst = { id: string; name: string; role: string; photo_url: string | null };

const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const ERR: Record<string, string> = {
  slot_taken: "Это время только что заняли. Выберите другое.",
  need_name: "Укажите ваше имя.",
  need_phone: "Укажите телефон.",
  need_sql: "Запись ещё настраивается. Попробуйте позже.",
  own_business: "Нельзя записаться к самому себе.",
  rate_limited: "Слишком много попыток. Подождите немного.",
};

function kyivToday(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
function addDays(d: string, n: number): string {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 === 0 ? `${m / 60} ч` : `${Math.floor(m / 60)} ч ${m % 60} мин`);

// Пошаговая запись: услуга, мастер, дата, время, контакты.
export default function BookingSheet({ businessId, shopName, services, masters, cur, presetServiceId, onClose }: { businessId: string; shopName: string; services: Svc[]; masters: Mst[]; cur: string; presetServiceId: string; onClose: () => void }) {
  const [svcId, setSvcId] = useState(presetServiceId);
  const [masterId, setMasterId] = useState<string | null>(null); // "" = любой мастер
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ time: string; masterId: string; masterName: string }[] | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; when: string; master: string } | null>(null);

  const svc = services.find((x) => x.id === svcId) ?? null;
  const mList = svc ? masters.filter((m) => !svc.master_ids.length || svc.master_ids.includes(m.id)) : [];
  const today = kyivToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  useEffect(() => {
    apiPost("/api/business/booking", { action: "prefill", businessId }).then((r: any) => {
      if (r?.ok) {
        setName((c) => c || r.name || "");
        setPhone((c) => c || r.phone || "");
      }
    });
  }, [businessId]);

  async function loadSlots(keep = false) {
    if (!svc || masterId === null || !date) return;
    setSlots(null);
    if (!keep) setTime("");
    const r = await apiPost("/api/business/booking", { action: "slots", businessId, serviceId: svc.id, masterId, date });
    setSlots(r?.ok ? r.slots : []);
  }
  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svcId, masterId, date]);

  async function submit() {
    if (!svc || masterId === null || !date || !time) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/booking", { action: "book", businessId, serviceId: svc.id, masterId, date, time, name, phone, note });
    setBusy(false);
    if (r?.ok) return setDone({ id: r.id, when: r.when, master: r.master });
    setErr(ERR[r?.error] ?? "Не получилось записаться. Попробуйте ещё раз.");
    if (r?.error === "slot_taken") loadSlots();
  }

  const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  const chip = (on: boolean) => `px-3.5 py-2 rounded-xl text-sm border text-left ${on ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`;
  const h = "text-offwhite text-sm font-semibold mb-2";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-bgSurface rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-offwhite font-semibold">📅 Запись · {shopName}</p>
          <button onClick={onClose} className="text-muted text-xl leading-none px-2">×</button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-offwhite font-semibold">Заявка отправлена</p>
            <p className="text-muted text-sm mt-1">{svc?.name} · {done.when} · мастер {done.master}</p>
            <p className="text-muted text-xs mt-2">Магазин подтвердит запись, мы пришлём уведомление. За 2 часа до визита напомним.</p>
            <Link href={`/my-orders?o=${done.id}`} className="block bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm mt-4">Открыть запись</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className={h}>1. Услуга</p>
              <div className="flex flex-col gap-2">
                {services.map((x) => (
                  <button key={x.id} onClick={() => { setSvcId(x.id); setMasterId(null); setDate(""); setSlots(null); setTime(""); }} className={chip(svcId === x.id)}>
                    <span className="flex justify-between gap-2"><span className="break-words">{x.name}</span><span className="flex-none">{money(x.price, cur)}</span></span>
                    <span className={`block text-xs ${svcId === x.id ? "text-bgPrimary/80" : "text-muted"}`}>{dur(x.duration_min)}{x.description ? ` · ${x.description}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>

            {svc && (
              <div>
                <p className={h}>2. Мастер</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { setMasterId(""); setDate(""); setSlots(null); setTime(""); }} className={chip(masterId === "")}>Любой свободный мастер</button>
                  {mList.map((m) => (
                    <button key={m.id} onClick={() => { setMasterId(m.id); setDate(""); setSlots(null); setTime(""); }} className={chip(masterId === m.id)}>
                      <span className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-full overflow-hidden bg-bgPrimary border border-gold/40 flex items-center justify-center text-gold text-xs font-bold flex-none">
                          {m.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            m.name.slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span className="min-w-0"><span className="block break-words">{m.name}</span>{m.role && <span className={`block text-xs ${masterId === m.id ? "text-bgPrimary/80" : "text-muted"}`}>{m.role}</span>}</span>
                      </span>
                    </button>
                  ))}
                  {mList.length === 0 && <p className="text-muted text-xs">Для этой услуги пока нет мастеров.</p>}
                </div>
              </div>
            )}

            {svc && masterId !== null && (
              <div>
                <p className={h}>3. Дата</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {days.map((d) => (
                    <button key={d} onClick={() => { setDate(d); setTime(""); }} className={`flex-none w-14 py-2 rounded-xl border text-center ${date === d ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>
                      <span className="block text-[11px] opacity-80">{WD[new Date(d + "T00:00:00Z").getUTCDay()]}</span>
                      <span className="block text-sm">{d.slice(8, 10)}.{d.slice(5, 7)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {svc && masterId !== null && date && (
              <div>
                <p className={h}>4. Время</p>
                {!slots && <p className="text-muted text-xs">Ищем свободное время...</p>}
                {slots && slots.length === 0 && <p className="text-muted text-xs">На эту дату нет свободного времени. Выберите другой день или мастера.</p>}
                {slots && slots.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button key={s.time} onClick={() => setTime(s.time)} className={`py-2 rounded-lg border text-sm ${time === s.time ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{s.time}</button>
                    ))}
                  </div>
                )}
                {time && masterId === "" && slots && <p className="text-muted text-xs mt-2">Мастер: {slots.find((x) => x.time === time)?.masterName}</p>}
              </div>
            )}

            {svc && masterId !== null && date && time && (
              <div className="flex flex-col gap-2">
                <p className={h}>5. Ваши данные</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" maxLength={80} className={input} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" inputMode="tel" maxLength={40} className={input} />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий (необязательно)" rows={2} maxLength={500} className={input} />
                {err && <p className="text-danger text-xs">{err}</p>}
                <button onClick={submit} disabled={busy} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Записываем..." : `Записаться · ${money(svc.price, cur)}`}</button>
                <p className="text-muted text-[11px] text-center">Оплата напрямую магазину, на месте или по договорённости в чате.</p>
              </div>
            )}
            {err && !(svc && masterId !== null && date && time) && <p className="text-danger text-xs">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
