import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { currencyOf, slotPrice } from "@/lib/adServer";

export const dynamic = "force-dynamic";

// «Мои заявки» в рекламном кабинете.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id, status, name, created_at, decision_note, price, ad_slots(title, category, slot_number, duration, full_price, presale_price, presale_until)")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = ((data ?? []) as any[]).map((r) => {
    const sl = Array.isArray(r.ad_slots) ? r.ad_slots[0] : r.ad_slots;
    return {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      note: r.decision_note ?? null,
      title: sl?.title ?? "Место удалено",
      category: sl?.category ?? "",
      price: r.price != null ? Number(r.price) : sl ? slotPrice(sl) : null,
    };
  });
  return NextResponse.json({ ok: true, items, currency: await currencyOf(await countryOfUser(uid)) });
}
