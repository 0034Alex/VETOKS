import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Места «журнал» и «жюри» продаются поштучно (статус sold), остальные — по количеству (sold_count из capacity).
const SEAT_CATS = ["magazine", "magazine_gf", "jury", "jury_gf"];
export const isSeatCat = (c: string) => SEAT_CATS.includes(c);

export function slotPrice(s: any): number {
  const presale = s.presale_price != null && s.presale_until && new Date(s.presale_until) > new Date();
  return Number(presale ? s.presale_price : s.full_price);
}

export function slotFree(s: any): boolean {
  if (isSeatCat(String(s.category))) return s.status !== "sold";
  return s.capacity == null || Number(s.sold_count) < Number(s.capacity);
}

export async function currencyOf(countryId: string | null): Promise<string> {
  if (!countryId) return "₴";
  const { data } = await supabaseAdmin.from("countries").select("currency_symbol").eq("id", countryId).maybeSingle();
  return (data as any)?.currency_symbol || "₴";
}
