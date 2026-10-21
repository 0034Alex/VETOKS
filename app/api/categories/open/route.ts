import { NextResponse } from "next/server";
import { teenOpen } from "@/lib/ageServer";

export const dynamic = "force-dynamic";

// Открыта ли категория TEEN (переключатель в CRM). Нужен, чтобы не показывать пустую категорию.
export async function GET() {
  return NextResponse.json({ teen_open: await teenOpen() });
}
