import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Какие места сейчас «в брони» (заявка подана или одобрена, ещё не оплачена). Видно всем вошедшим.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("slot_id, user_id")
    .in("status", ["new", "approved", "paying"]);
  const reserved: Record<string, "mine" | "other"> = {};
  for (const r of (data ?? []) as any[]) {
    if (!r.slot_id) continue;
    if (r.user_id === uid) reserved[r.slot_id] = "mine";
    else if (!reserved[r.slot_id]) reserved[r.slot_id] = "other";
  }
  return NextResponse.json({ ok: true, reserved });
}
