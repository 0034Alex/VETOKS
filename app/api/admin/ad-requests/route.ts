import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { notify } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { currencyOf, slotFree, slotPrice } from "@/lib/adServer";

export const dynamic = "force-dynamic";

// CRM → заявки на рекламу: одобрить (человек получает цену и платит) или отклонить с причиной.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  const note = String(b.note ?? "").trim().slice(0, 500);
  const act = b.action;
  if (act !== "approve" && act !== "reject") return NextResponse.json({ ok: false }, { status: 400 });

  const { data: r } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id, user_id, status, slot_id, ad_slots(title, category, status, capacity, sold_count, full_price, presale_price, presale_until)")
    .eq("id", id)
    .maybeSingle();
  if (!r) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!r.user_id) return NextResponse.json({ ok: false, error: "no_user" }, { status: 400 });
  const sl: any = Array.isArray((r as any).ad_slots) ? (r as any).ad_slots[0] : (r as any).ad_slots;
  const userId = String(r.user_id);

  if (act === "reject") {
    await supabaseAdmin.from("ad_slot_requests").update({ status: "rejected", decision_note: note || null, decided_at: new Date().toISOString() }).eq("id", id);
    await logAction(uid, "ad_request_reject", userId, { request: id });
    await notify(userId, `К сожалению, заявка на рекламу «${sl?.title ?? ""}» не одобрена.${note ? " Причина: " + note : ""}`, "/ad-space", "other");
    return NextResponse.json({ ok: true });
  }

  if (!sl || !slotFree(sl)) return NextResponse.json({ ok: false, error: "slot_full" }, { status: 409 });
  const price = slotPrice(sl);
  await supabaseAdmin.from("ad_slot_requests").update({ status: "approved", price, decision_note: note || null, decided_at: new Date().toISOString() }).eq("id", id);
  await logAction(uid, "ad_request_approve", userId, { request: id, price });
  const cur = await currencyOf(await countryOfUser(userId));
  await notify(
    userId,
    `✅ Заявка на рекламу «${sl.title}» одобрена! К оплате ${Math.round(price)} ${cur}. Откройте Рекламный кабинет → «Мои заявки» и нажмите «Оплатить».`,
    "/ad-space",
    "other"
  );
  return NextResponse.json({ ok: true, price });
}
