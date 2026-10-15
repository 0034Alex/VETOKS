import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { getUsdRate, giftUahPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Подарки для чата с ценами в гривнах (по курсу из CRM).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data } = await supabaseAdmin
    .from("gift_catalog")
    .select("id, name, price, usd_price")
    .eq("chat_only", true)
    .eq("is_active", true);
  const rate = await getUsdRate();
  const items = ((data ?? []) as any[])
    .map((g) => ({ id: g.id, name: g.name, price: giftUahPrice(g, rate) }))
    .sort((a, b) => a.price - b.price);
  const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", uid).order("id").limit(1).maybeSingle();
  return NextResponse.json({ ok: true, items, balance: w ? Number(w.balance) : 0 });
}
