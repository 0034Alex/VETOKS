import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Кошелёк создаёт только сервер.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data: w } = await supabaseAdmin.from("wallets").select("id, balance").eq("user_id", uid).maybeSingle();
  if (w) return NextResponse.json({ ok: true, wallet: w });
  const { data: nw } = await supabaseAdmin.from("wallets").insert({ user_id: uid }).select("id, balance").single();
  return NextResponse.json({ ok: true, wallet: nw ?? null });
}
