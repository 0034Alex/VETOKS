import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runDailyJob } from "@/lib/dailyJob";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Внешний планировщик вызывает этот адрес каждый день в 00:01 по Киеву:
//   https://ВАШ-САЙТ/api/cron/daily?key=ВАШ_CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "no_secret_configured" }, { status: 500 });

  const url = new URL(req.url);
  const given =
    url.searchParams.get("key") ||
    req.headers.get("x-cron-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!same(given, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const summary = await runDailyJob();
  return NextResponse.json({ ok: true, summary });
}
