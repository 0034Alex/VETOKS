import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { logSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";

// Ошибка в приложении у человека. Без входа, но с лимитом; повторы одной и той же ошибки сворачиваются.
export async function POST(req: Request) {
  const rl = await rateLimit(req, "client-error", 10, 600);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const message = String(b.message ?? "").slice(0, 300);
  if (!message) return NextResponse.json({ ok: true });
  const where = String(b.where ?? "").slice(0, 120);
  await logSecurity(
    "client_error",
    { message, where, ua: String(b.ua ?? "").slice(0, 160), stack: String(b.stack ?? "").slice(0, 400) },
    { req, alert: true, dedupeKey: `${where}:${message}`.slice(0, 150), dedupeSec: 1800 }
  );
  return NextResponse.json({ ok: true });
}
