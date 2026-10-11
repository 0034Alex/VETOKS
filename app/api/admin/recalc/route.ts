import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { runDailyJob } from "@/lib/dailyJob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Кнопка «Посчитать сейчас» в CRM — только для персонала.
export async function POST(req: Request) {
  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  if (!data || !["moderator", "finance_admin", "super_admin"].includes(data.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const summary = await runDailyJob();
  return NextResponse.json({ ok: true, summary });
}
