import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { getRefSettings } from "@/lib/referral";

export const dynamic = "force-dynamic";

// Новый человек пришёл по ссылке друга — запоминаем, кто пригласил.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  let code = String(body.code ?? "").trim().slice(0, 40);
  if (!code) return bad("no_code");
  // Вместо кода можно прислать ник пригласившего (с @ или без).
  const asNick = code.replace(/^@/, "").toLowerCase();
  if (/^[a-z][a-z0-9_]{2,19}$/.test(asNick)) {
    const { data: byNick } = await supabaseAdmin.from("users").select("referral_code").eq("nick", asNick).maybeSingle();
    if (byNick?.referral_code) code = String(byNick.referral_code);
  }
  const s = await getRefSettings();
  if (!s.enabled) return bad("disabled");
  const { data } = await supabaseAdmin.rpc("vt_claim_referral", { p_user: uid, p_code: code, p_daily: s.dailyLimit });
  return NextResponse.json({ ok: !!(data as any)?.ok, error: (data as any)?.error });
}
