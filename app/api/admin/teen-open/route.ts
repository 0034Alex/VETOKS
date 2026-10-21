import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { teenOpen } from "@/lib/ageServer";

export const dynamic = "force-dynamic";

// Переключатель «Открыть категорию TEEN 15–17». Только владелец.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  if (b.action === "set") {
    const on = b.open === true;
    await supabaseAdmin.from("platform_settings").upsert({ key: "teen_open", value: on ? "true" : "false" });
    await logAction(uid, on ? "teen_open" : "teen_close", null);
  }
  return NextResponse.json({ ok: true, open: await teenOpen() });
}
