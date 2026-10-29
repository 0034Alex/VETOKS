import { NextResponse } from "next/server";
import { countryOfUser } from "@/lib/countryServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { applyGiftOverrides, getUsdRate, giftUahPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Подарки для чата с ценами в гривнах (по курсу из CRM).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data } = await supabaseAdmin
    .from("gift_catalog")
    .select("*")
    .eq("chat_only", true);
  const cid = await countryOfUser(uid);
  const rate = await getUsdRate(cid);
  const items = (await applyGiftOverrides((data ?? []) as any[], cid))
    .filter((g) => g.is_active)
    .map((g) => ({ id: g.id, name: g.name, art: (g as any).art ?? null, price: giftUahPrice(g, rate) }))
    .sort((a, b) => a.price - b.price);
  const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", uid).order("id").limit(1).maybeSingle();
  return NextResponse.json({ ok: true, items, balance: w ? Number(w.balance) : 0 });
}
