import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Car } from "@/lib/carsShared";

// Если SQL «Авто» ещё не выполнен, всё работает как раньше, раздел пустой.
let ready = false;
export async function carsReady(): Promise<boolean> {
  if (ready) return true;
  const a = await supabaseAdmin.from("business_cars").select("id").limit(1);
  const b = await supabaseAdmin.from("business_orders").select("car_id").limit(1);
  ready = !a.error && !b.error;
  return ready;
}

export async function getBizType(bizId: string): Promise<string | null> {
  const r = await supabaseAdmin.from("business_profiles").select("biz_type").eq("id", bizId).maybeSingle();
  if (r.error) return null;
  return ((r.data as any)?.biz_type as string | null) ?? null;
}

const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
export const mapCar = (x: any): Car => ({
  id: String(x.id),
  make: String(x.make ?? ""),
  model: String(x.model ?? ""),
  year: x.year === null || x.year === undefined ? null : Number(x.year),
  mileage_km: x.mileage_km === null || x.mileage_km === undefined ? null : Number(x.mileage_km),
  body: String(x.body ?? ""),
  engine_vol: x.engine_vol === null || x.engine_vol === undefined ? null : Number(x.engine_vol),
  fuel: String(x.fuel ?? ""),
  gearbox: String(x.gearbox ?? ""),
  drive: String(x.drive ?? ""),
  vin: String(x.vin ?? ""),
  features: arr(x.features).map(String),
  price: Number(x.price) || 0,
  currency: String(x.currency ?? "USD"),
  negotiable: !!x.negotiable,
  description: String(x.description ?? ""),
  photos: arr(x.photos).map(String),
  status: ["available", "reserved", "sold"].includes(x.status) ? x.status : "available",
  is_active: x.is_active !== false,
});

// Зрителю: только активные и не проданные. Владельцу: все.
export async function loadCars(bizId: string, viewer: boolean): Promise<Car[]> {
  let q = supabaseAdmin.from("business_cars").select("*").eq("business_id", bizId).order("created_at", { ascending: false }).limit(300);
  if (viewer) q = q.eq("is_active", true).neq("status", "sold");
  const r = await q;
  return r.error ? [] : ((r.data as any[]) ?? []).map(mapCar);
}
