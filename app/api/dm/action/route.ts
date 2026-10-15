import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { findThread } from "@/lib/dmServer";

export const dynamic = "force-dynamic";

const REASONS = ["spam", "insult", "scam", "nudity", "other"];

// Действия с чатом: принять запрос, удалить запрос, заблокировать, разблокировать, пожаловаться.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const other = String(b.userId || "");
  if (!other || other === uid) return bad("bad_request");

  const thread = await findThread(uid, other);

  if (action === "accept") {
    if (thread && thread.initiator !== uid) await supabaseAdmin.from("dm_threads").update({ accepted: true }).eq("id", thread.id);
    return NextResponse.json({ ok: true });
  }
  if (action === "decline") {
    if (thread && thread.initiator !== uid && !thread.accepted) await supabaseAdmin.from("dm_threads").delete().eq("id", thread.id);
    return NextResponse.json({ ok: true });
  }
  if (action === "block") {
    await supabaseAdmin.from("user_blocks").upsert({ blocker_id: uid, blocked_id: other });
    return NextResponse.json({ ok: true });
  }
  if (action === "unblock") {
    await supabaseAdmin.from("user_blocks").delete().eq("blocker_id", uid).eq("blocked_id", other);
    return NextResponse.json({ ok: true });
  }
  if (action === "report") {
    const reason = REASONS.includes(b.reason) ? b.reason : "other";
    const details = String(b.details ?? "").slice(0, 500);
    if (!thread) return bad("no_thread", 404);
    const { error } = await supabaseAdmin
      .from("dm_reports")
      .insert({ reporter_id: uid, reported_id: other, thread_id: thread.id, reason, details });
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true });
  }
  return bad("bad_request");
}
