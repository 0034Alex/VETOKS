import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Голосование. Все проверки (номер, лимиты, баланс) — внутри базы одной операцией.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => ({}));
  const participantId = String(body.participantId || "");
  const count = Math.floor(Number(body.count) || 1);
  if (!participantId) return bad("bad_request");

  const { data, error } = await supabaseAdmin.rpc("vt_cast_votes", {
    p_user: uid,
    p_participant: participantId,
    p_count: count,
  });
  if (error || !data) return bad("server", 500);
  return NextResponse.json(data);
}
