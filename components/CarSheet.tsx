"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { Car, carTitle, carPrice, km, CAR_STATUS } from "@/lib/carsShared";

const ERR: Record<string, string> = {
  need_name: "Укажите ваше имя.",
  need_phone: "Укажите телефон.",
  bad_date: "Выберите дату и время, которые ещё не прошли.",
  no_car: "Этот автомобиль уже недоступен.",
  need_sql: "Запись ещё настраивается. Попробуйте позже.",
  own_business: "Нельзя записаться к самому себе.",
};
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

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

// Карточка автомобиля: галерея, характеристики, комплектация, действия.
export default function CarSheet({ car, businessId, ownerUserId, phone, canAct, onClose }: { car: Car; businessId: string; ownerUserId: string | null; phone: string; canAct: boolean; onClose: () => void }) {
  const [gi, setGi] = useState(0);
  const [visit, setVisit] = useState(false);
  const [kind, setKind] = useState<"look" | "drive">("look");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; when: string } | null>(null);

  useEffect(() => {
    if (!visit) return;
    apiPost("/api/business/carlead", { action: "prefill", businessId }).then((r: any) => {
      if (r?.ok) {
        setName((c) => c || r.name || "");
        setTel((c) => c || r.phone || "");
      }
    });
  }, [visit, businessId]);

  const today = kyivToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";

  async function submit() {
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/carlead", { businessId, carId: car.id, kind, date, time, name, phone: tel, note });
    setBusy(false);
    if (r?.ok) setDone({ id: r.id, when: r.when });
    else setErr(ERR[r?.error] ?? "Не получилось отправить. Попробуйте ещё раз.");
  }

  const quick: [string, string][] = [
    ["Год", car.year ? String(car.year) : "—"],
    ["Пробег", km(car.mileage_km)],
    ["Двигатель", `${car.engine_vol ? car.engine_vol.toFixed(1) + " л" : "—"}${car.fuel ? ", " + car.fuel.toLowerCase() : ""}`],
    ["Коробка", car.gearbox || "—"],
  ];
  const specs: [string, string][] = [["Кузов", car.body], ["Привод", car.drive], ["VIN", car.vin]].filter(([, v]) => v) as [string, string][];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-bgSurface rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-video bg-bgPrimary">
          {car.photos[gi] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={car.photos[gi]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🚗</div>
          )}
          <button onClick={onClose} className="absolute right-2 top-2 w-8 h-8 rounded-full bg-black/60 text-white text-lg leading-none">×</button>
          {car.status !== "available" && <span className="absolute left-2 top-2 bg-gold text-bgPrimary text-xs font-bold rounded-full px-2.5 py-0.5">{CAR_STATUS[car.status]}</span>}
          {car.photos.length > 1 && (
            <>
              <button onClick={() => setGi((gi + car.photos.length - 1) % car.photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white">‹</button>
              <button onClick={() => setGi((gi + 1) % car.photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white">›</button>
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] rounded-full px-2 py-0.5">{gi + 1}/{car.photos.length}</span>
            </>
          )}
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <p className="text-offwhite font-semibold text-lg break-words">{carTitle(car)}</p>
            <p className="text-gold font-bold text-xl">{carPrice(car.price, car.currency)}</p>
            {car.negotiable && <p className="text-muted text-xs">Возможен торг или кредит</p>}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {quick.map(([l, v]) => (
              <div key={l} className="bg-bgPrimary border border-muted/60 rounded-xl p-2 text-center min-w-0">
                <p className="text-muted text-[10px]">{l}</p>
                <p className="text-offwhite text-xs font-semibold break-words">{v}</p>
              </div>
            ))}
          </div>

          {specs.length > 0 && (
            <div className="flex flex-col gap-1">
              {specs.map(([l, v]) => (
                <p key={l} className="text-sm flex justify-between gap-3"><span className="text-muted">{l}</span><span className="text-offwhite break-all text-right">{v}</span></p>
              ))}
            </div>
          )}

          {car.features.length > 0 && (
            <div>
              <p className="text-offwhite text-sm font-semibold mb-1.5">Комплектация</p>
              <div className="flex flex-wrap gap-1.5">
                {car.features.map((f) => <span key={f} className="text-xs border border-gold/40 text-offwhite rounded-full px-2.5 py-1">✓ {f}</span>)}
              </div>
            </div>
          )}
          {car.description && <p className="text-muted text-sm whitespace-pre-wrap break-words">{car.description}</p>}

          {done ? (
            <div className="text-center py-2">
              <p className="text-offwhite font-semibold">✅ Заявка отправлена</p>
              <p className="text-muted text-sm mt-1">{done.when}. Магазин подтвердит время.</p>
              <Link href={`/my-orders?o=${done.id}`} className="block bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm mt-3">Открыть заявку</Link>
            </div>
          ) : visit ? (
            <div className="flex flex-col gap-2 border-t border-muted/50 pt-3">
              <div className="flex gap-2">
                {([["look", "Осмотр"], ["drive", "Тест-драйв"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setKind(k)} className={`flex-1 py-2 rounded-full text-sm border ${kind === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => (
                  <button key={d} onClick={() => setDate(d)} className={`flex-none w-14 py-2 rounded-xl border text-center ${date === d ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>
                    <span className="block text-[11px] opacity-80">{WD[new Date(d + "T00:00:00Z").getUTCDay()]}</span>
                    <span className="block text-sm">{d.slice(8, 10)}.{d.slice(5, 7)}</span>
                  </button>
                ))}
              </div>
              {date && (
                <div className="grid grid-cols-4 gap-2">
                  {HOURS.map((h) => (
                    <button key={h} onClick={() => setTime(h)} className={`py-2 rounded-lg border text-sm ${time === h ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{h}</button>
                  ))}
                </div>
              )}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" maxLength={80} className={input} />
              <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Телефон" inputMode="tel" maxLength={40} className={input} />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий (необязательно)" rows={2} maxLength={500} className={input} />
              {err && <p className="text-danger text-xs">{err}</p>}
              <button onClick={submit} disabled={busy || !date || !time} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Отправляем..." : "Отправить заявку"}</button>
              <p className="text-muted text-[11px] text-center">Время предварительное: магазин подтвердит или предложит другое.</p>
            </div>
          ) : car.status === "sold" ? null : (
            <div className="flex flex-col gap-2 border-t border-muted/50 pt-3">
              <button onClick={() => setVisit(true)} disabled={!canAct} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">📅 Записаться на осмотр / тест-драйв</button>
              <div className="flex gap-2">
                {phone && <a href={`tel:${phone}`} className="flex-1 text-center border border-gold text-gold font-semibold rounded-full py-2.5 text-sm">📞 Позвонить</a>}
                {ownerUserId && canAct && <Link href={`/chats/${ownerUserId}`} className="flex-1 text-center border border-gold/60 text-gold font-semibold rounded-full py-2.5 text-sm">💬 Написать</Link>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
