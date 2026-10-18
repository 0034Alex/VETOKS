import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// «У вас новый подписчик»: уведомление создаёт сервер, и только если подписка настоящая.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "follownotify", 60, 600, uid);
  if (rl) return rl;

  const b = await req.json().catch(() => ({}));
  const pid = String(b.participantId ?? "");
  if (!pid) return bad("bad_request");

  const { data: f } = await supabaseAdmin
    .from("participant_follows")
    .select("id")
    .eq("participant_id", pid)
    .eq("user_id", uid)
    .maybeSingle();
  if (!f) return bad("not_following", 400);

  const { data: p } = await supabaseAdmin.from("participants").select("user_id").eq("id", pid).maybeSingle();
  if (!p?.user_id || p.user_id === uid) return NextResponse.json({ ok: true });

  // Не чаще раза в сутки на одну пару, чтобы подписка-отписка не спамила.
  const link = `/participant/${pid}`;
  const since = new Date(Date.now() - 86400000).toISOString();
  const { data: dup } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", p.user_id)
    .eq("link", link)
    .eq("message", "👥 У вас новый подписчик")
    .gte("created_at", since)
    .limit(1);
  if (dup && dup.length) return NextResponse.json({ ok: true, skipped: true });

  await supabaseAdmin.from("notifications").insert({ user_id: p.user_id, message: "👥 У вас новый подписчик", link });
  return NextResponse.json({ ok: true });
}
