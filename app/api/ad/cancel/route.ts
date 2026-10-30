import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Рекламодатель отменяет свою неоплаченную заявку («Мои заявки» в рекламном кабинете).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return bad("no_id");
  const { data: r } = await supabaseAdmin.from("ad_slot_requests").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!r || (r as any).user_id !== uid) return bad("not_found", 404);
  if (!["new", "approved"].includes((r as any).status)) return bad("cannot_cancel");
  const { error } = await supabaseAdmin
    .from("ad_slot_requests")
    .update({ status: "rejected", decision_note: "Отменено рекламодателем" })
    .eq("id", id)
    .in("status", ["new", "approved"]);
  if (error) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
