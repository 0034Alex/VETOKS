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
    .select("id, status, name, created_at, decided_at, first_decided_at, decision_note, price, slot_id, link_url, ad_text, image_url, message, edit_kind, pending_edit, live_until, live_table, ad_slots(title, category, slot_number, duration, full_price, presale_price, presale_until)")
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
      decided_at: r.decided_at ?? null,
      // На оплату даётся 24 часа с первого одобрения (правки срок не продлевают).
      expires_at: (r.first_decided_at ?? r.decided_at) ? new Date(new Date(r.first_decided_at ?? r.decided_at).getTime() + 24 * 3600 * 1000).toISOString() : null,
      slot_id: r.slot_id,
      company: r.name,
      link_url: r.link_url ?? "",
      ad_text: r.ad_text ?? "",
      image_url: r.image_url ?? null,
      comment: r.message ?? "",
      edit_kind: r.edit_kind ?? null,
      has_pending: !!r.pending_edit,
      live_until: r.live_until ?? null,
      live: !!r.live_table,
      title: sl?.title ?? "Место удалено",
      category: sl?.category ?? "",
      price: r.price != null ? Number(r.price) : sl ? slotPrice(sl) : null,
    };
  });
  return NextResponse.json({ ok: true, items, currency: await currencyOf(await countryOfUser(uid)) });
}
