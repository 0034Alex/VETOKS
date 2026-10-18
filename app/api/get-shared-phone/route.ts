import { NextResponse } from "next/server";

// Служебный адрес отключён из соображений безопасности.
export async function GET() {
  return NextResponse.json({ ok: false, error: "gone" }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ ok: false, error: "gone" }, { status: 410 });
}
