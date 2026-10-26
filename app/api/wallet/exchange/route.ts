import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { coinSettingsOfUser } from "@/lib/coinsServer";

export const dynamic = "force-dynamic";

// Обмен Корон на монеты. Только в одну сторону: обратно монеты в Короны не превращаются.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "wallet/exchange", 20, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const crowns = Math.floor(Number(b.crowns) * 100) / 100;
  if (!isFinite(crowns) || crowns <= 0) return bad("bad_amount");

  const s = await coinSettingsOfUser(uid);
  if (!s.exchangeOn) return bad("disabled", 403);

  const { data, error } = await supabaseAdmin.rpc("vt_exchange", { p_user: uid, p_crowns: crowns, p_rate: s.coinsPerCrown });
  if (error || !data) return bad("server", 500);
  const r = data as any;
  if (!r.ok) return bad(r.error === "not_enough" ? "not_enough" : "bad_amount", r.error === "not_enough" ? 402 : 400, { crowns: r.crowns });
  return NextResponse.json({ ok: true, coins: r.coins, balance: r.balance });
}
