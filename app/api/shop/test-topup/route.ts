import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// ТЕСТОВОЕ пополнение +1000. Перед запуском реальных платежей выключается
// в базе: update platform_settings set value='false' where key='test_topup_enabled';
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const { data: set } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "test_topup_enabled")
    .maybeSingle();
  if (set?.value === "false") return bad("disabled", 403);

  const { data, error } = await supabaseAdmin.rpc("vt_topup", { p_user: uid, p_amount: 1000 });
  if (error) return bad("server", 500);
  return NextResponse.json({ ok: true, balance: data });
}
