import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Запоминаем на сервере: окно «подтвердите номер» уже показывали / закрыли.
export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  if (body.kind === "auto") {
    await supabaseAdmin.from("users").update({ verify_prompt_at: now }).eq("id", userId).is("verify_prompt_at", null);
  } else if (body.kind === "dismiss") {
    await supabaseAdmin.from("users").update({ verify_dismiss_at: now }).eq("id", userId);
  } else {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
