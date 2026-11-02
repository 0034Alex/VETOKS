import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Dish, ModGroup } from "@/lib/foodShared";

// Если SQL «Еда» ещё не выполнен, раздел пустой, остальное работает.
let ready = false;
export async function foodReady(): Promise<boolean> {
  if (ready) return true;
  const a = await supabaseAdmin.from("business_dishes").select("id").limit(1);
  const b = await supabaseAdmin.from("business_orders").select("order_type, pay_method").limit(1);
  ready = !a.error && !b.error;
  return ready;
}

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

// Приводим группы модификаторов к безопасному виду.
export function cleanMods(raw: any): ModGroup[] {
  const out: ModGroup[] = [];
  for (const g of Array.isArray(raw) ? raw.slice(0, 10) : []) {
    const type = g?.type === "single" ? "single" : g?.type === "remove" ? "remove" : "multi";
    const title = s(g?.title, 60);
    if (!title) continue;
    const options = (Array.isArray(g?.options) ? g.options.slice(0, 30) : [])
      .map((o: any) => ({ name: s(o?.name, 60), price: type === "remove" ? 0 : Math.max(0, Math.round((Number(o?.price) || 0) * 100) / 100) }))
      .filter((o: any) => o.name);
    if (!options.length) continue;
    out.push({ id: s(g?.id, 30) || `g${out.length + 1}`, title, type, options });
  }
  return out;
}

export const mapDish = (x: any): Dish => ({
  id: String(x.id),
  name: String(x.name ?? ""),
  description: String(x.description ?? ""),
  weight: String(x.weight ?? ""),
  price: Number(x.price) || 0,
  category: String(x.category ?? ""),
  photo_url: x.photo_url ?? null,
  modifiers: cleanMods(x.modifiers),
  in_stock: x.in_stock !== false,
  is_active: x.is_active !== false,
});

export async function loadDishes(bizId: string, viewer: boolean): Promise<Dish[]> {
  let q = supabaseAdmin.from("business_dishes").select("*").eq("business_id", bizId).order("created_at", { ascending: true }).limit(500);
  if (viewer) q = q.eq("is_active", true);
  const r = await q;
  return r.error ? [] : ((r.data as any[]) ?? []).map(mapDish);
}
