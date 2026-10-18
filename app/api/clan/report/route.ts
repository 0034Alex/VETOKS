import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "clan/report", 10, 3600, uid);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  const messageId = String(body.messageId ?? "");
  if (!messageId) return bad("no_message");
  const reason = String(body.reason ?? "other").slice(0, 20);
  const details = String(body.details ?? "").slice(0, 500);
  let { error } = await supabaseAdmin
    .from("clan_reports")
    .insert({ message_id: messageId, reporter_id: uid, reason, details });
  // Если колонок причины в базе ещё нет — сохраняем жалобу без них.
  if (error && /reason|details|column/i.test(String(error.message))) {
    ({ error } = await supabaseAdmin.from("clan_reports").insert({ message_id: messageId, reporter_id: uid }));
  }
  if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
