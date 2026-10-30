import { NextResponse } from "next/server";
import { bad, requireUser } from "@/lib/shopServer";
import { claimReferral } from "@/lib/referral";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Новый человек пришёл по ссылке друга (или ввёл код/ник руками) — запоминаем, кто пригласил.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "referral/claim", 10, 600, uid);
  if (rl) return rl;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");
  if (!code.trim()) return bad("no_code");
  const r = await claimReferral(uid, code, body.kind === "advertiser" ? "advertiser" : "friend");
  return NextResponse.json({ ok: r.ok, error: r.error, referrerName: r.referrerName ?? null });
}
