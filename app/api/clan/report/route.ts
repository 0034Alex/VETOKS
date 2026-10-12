import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const messageId = String(body.messageId ?? "");
  if (!messageId) return bad("no_message");
  const { error } = await supabaseAdmin
    .from("clan_reports")
    .insert({ message_id: messageId, reporter_id: uid });
  if (error && !String(error.message).includes("duplicate")) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
