import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser, settingsForCountry } from "@/lib/countryServer";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// ТЕСТОВОЕ пополнение +1000. Включается/выключается в CRM (Цены → переключатель).
// {check:true} только сообщает, включено ли оно.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "shop/test-topup", 10, 3600, uid);
  if (rl) return rl;

  const set = await settingsForCountry(["test_topup_enabled"], await countryOfUser(uid));
  const enabled = set.test_topup_enabled !== "false";
  const body = await req.json().catch(() => ({}));
  if (body?.check) return NextResponse.json({ ok: true, enabled });
  if (!enabled) return bad("disabled", 403);

  const { data, error } = await supabaseAdmin.rpc("vt_topup", { p_user: uid, p_amount: 1000 });
  if (error) return bad("server", 500);
  return NextResponse.json({ ok: true, balance: data });
}
