import { NextResponse } from "next/server";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { recordConsents } from "@/lib/consents";

export const dynamic = "force-dynamic";

// После отправки анкеты: запоминаем, какие документы человек принял.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "consent/record", 10, 600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  if (b.place !== "apply") return bad("bad_request");
  await recordConsents(uid, "apply");
  return NextResponse.json({ ok: true });
}
