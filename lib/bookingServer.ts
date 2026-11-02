import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/shopServer";

// Запись по слотам: услуги, мастера, свободное время. Время везде по Киеву.
let ready = false;
export async function bookingReady(): Promise<boolean> {
  if (ready) return true;
  const a = await supabaseAdmin.from("business_masters").select("id").limit(1);
  const b = await supabaseAdmin.from("business_services").select("id").limit(1);
  const c = await supabaseAdmin.from("business_orders").select("master_id, slot_date, slot_time, duration_min, remind_sent_at").limit(1);
  ready = !a.error && !b.error && !c.error;
  return ready;
}

export function kyivNow(): { date: string; min: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  const h = Number(g("hour")) % 24;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, min: h * 60 + Number(g("minute")) };
}

export const toMin = (t: string): number => {
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
export const fromMin = (n: number): string => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z"));
// День недели 1..7 (понедельник = 1)
export const isoDow = (d: string): number => {
  const w = new Date(d + "T00:00:00Z").getUTCDay();
  return w === 0 ? 7 : w;
};
export const dayDiff = (a: string, b: string): number => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
export const ruDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

export type Master = { id: string; name: string; role: string; photo_url: string | null; work_days: number[]; start_time: string; end_time: string; slot_min: number; days_off: string[]; is_active: boolean };
export type Service = { id: string; name: string; category: string; price: number; duration_min: number; description: string; master_ids: string[]; is_active: boolean };

const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
export const mapMaster = (m: any): Master => ({
  id: String(m.id),
  name: String(m.name ?? ""),
  role: String(m.role ?? ""),
  photo_url: m.photo_url ?? null,
  work_days: arr(m.work_days).map(Number).filter((x) => x >= 1 && x <= 7),
  start_time: String(m.start_time ?? "10:00"),
  end_time: String(m.end_time ?? "19:00"),
  slot_min: Math.max(5, Number(m.slot_min) || 30),
  days_off: arr(m.days_off).map(String),
  is_active: m.is_active !== false,
});
export const mapService = (x: any): Service => ({
  id: String(x.id),
  name: String(x.name ?? ""),
  category: String(x.category ?? ""),
  price: Number(x.price) || 0,
  duration_min: Math.max(5, Number(x.duration_min) || 60),
  description: String(x.description ?? ""),
  master_ids: arr(x.master_ids).map(String),
  is_active: x.is_active !== false,
});

export async function loadCatalog(businessId: string, activeOnly: boolean): Promise<{ masters: Master[]; services: Service[] }> {
  let mq = supabaseAdmin.from("business_masters").select("*").eq("business_id", businessId).order("created_at", { ascending: true });
  let sq = supabaseAdmin.from("business_services").select("*").eq("business_id", businessId).order("created_at", { ascending: true });
  if (activeOnly) {
    mq = mq.eq("is_active", true);
    sq = sq.eq("is_active", true);
  }
  const [m, s] = await Promise.all([mq, sq]);
  return { masters: m.error ? [] : ((m.data as any[]) ?? []).map(mapMaster), services: s.error ? [] : ((s.data as any[]) ?? []).map(mapService) };
}

// Мастера, которые делают эту услугу (пустой список у услуги = все активные).
export function mastersFor(service: Service, masters: Master[]): Master[] {
  const act = masters.filter((m) => m.is_active);
  return service.master_ids.length ? act.filter((m) => service.master_ids.includes(m.id)) : act;
}

export type Slot = { time: string; masterId: string; masterName: string };

// Свободное время на дату. masterId пустой = любой мастер (время без повторов).
export async function freeSlots(businessId: string, service: Service, masters: Master[], masterId: string, date: string): Promise<Slot[]> {
  if (!validDate(date)) return [];
  const now = kyivNow();
  const diff = dayDiff(now.date, date);
  if (diff < 0 || diff > 60) return [];
  let cand = mastersFor(service, masters);
  if (masterId) cand = cand.filter((m) => m.id === masterId);
  if (!cand.length) return [];
  const { data } = await supabaseAdmin
    .from("business_orders")
    .select("master_id, slot_time, duration_min, status")
    .eq("business_id", businessId)
    .eq("slot_date", date)
    .neq("status", "cancelled");
  const busy: Record<string, [number, number][]> = {};
  for (const o of ((data as any[]) ?? [])) {
    const t = toMin(String(o.slot_time));
    if (!o.master_id || isNaN(t)) continue;
    (busy[o.master_id] ||= []).push([t, t + (Number(o.duration_min) || 60)]);
  }
  const dow = isoDow(date);
  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const m of cand) {
    if (!m.work_days.includes(dow) || m.days_off.includes(date)) continue;
    const st = toMin(m.start_time);
    const en = toMin(m.end_time);
    if (isNaN(st) || isNaN(en)) continue;
    for (let t = st; t + service.duration_min <= en; t += m.slot_min) {
      if (diff === 0 && t <= now.min) continue;
      const end = t + service.duration_min;
      if ((busy[m.id] ?? []).some(([a, b]) => t < b && end > a)) continue;
      const key = fromMin(t);
      if (!masterId && seen.has(key)) continue;
      seen.add(key);
      out.push({ time: key, masterId: m.id, masterName: m.name });
    }
  }
  return out.sort((x, y) => (x.time < y.time ? -1 : x.time > y.time ? 1 : 0));
}

// Напоминания: за ~2 часа до подтверждённой записи. Вызывается планировщиком каждые 15–30 минут.
export async function sendReminders(): Promise<number> {
  if (!(await bookingReady())) return 0;
  const now = kyivNow();
  const { data } = await supabaseAdmin
    .from("business_orders")
    .select("id, buyer_id, business_id, product_name, master_name, slot_date, slot_time")
    .eq("kind", "book")
    .eq("status", "confirmed")
    .is("remind_sent_at", null)
    .gte("slot_date", now.date)
    .limit(500);
  let n = 0;
  for (const o of ((data as any[]) ?? [])) {
    const t = toMin(String(o.slot_time));
    if (isNaN(t)) continue;
    const left = dayDiff(now.date, String(o.slot_date)) * 1440 + t - now.min;
    if (left <= 0 || left > 150) continue;
    const { data: bp } = await supabaseAdmin.from("business_profiles").select("name").eq("id", o.business_id).maybeSingle();
    await notify(o.buyer_id, `⏰ Напоминаем: сегодня в ${o.slot_time} у вас запись «${o.product_name}»${o.master_name ? `, мастер ${o.master_name}` : ""} — ${(bp as any)?.name ?? "магазин"}. Ждём вас!`, `/my-orders?o=${o.id}`, "other");
    await supabaseAdmin.from("business_orders").update({ remind_sent_at: new Date().toISOString() }).eq("id", o.id);
    n++;
  }
  return n;
}
