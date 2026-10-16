import { NextResponse } from "next/server";
import { getCardInfo } from "@/lib/cardInfo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const info = await getCardInfo(String(body.id ?? ""));
  if (!info) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, info });
}
