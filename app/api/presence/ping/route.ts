import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Приложение раз в пару минут сообщает, что человек сейчас в нём.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "presence/ping", 8, 60, uid);
  if (rl) return rl;
  await supabaseAdmin.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", uid);
  return NextResponse.json({ ok: true });
}
