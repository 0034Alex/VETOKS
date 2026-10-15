import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Мои подарки из чатов (для профиля): название → сколько штук.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data } = await supabaseAdmin
    .from("user_gifts")
    .select("gift_name, quantity")
    .eq("recipient_id", uid)
    .limit(2000);
  const map: Record<string, number> = {};
  (data ?? []).forEach((r: any) => (map[r.gift_name] = (map[r.gift_name] ?? 0) + Number(r.quantity || 1)));
  return NextResponse.json({ ok: true, items: Object.entries(map).map(([name, qty]) => ({ name, qty })) });
}
