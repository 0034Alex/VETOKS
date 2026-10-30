import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { BIZ_COLS, publicBiz } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Публичная страница партнёра. Видна всем сразу, пока партнёр включил её и не скрыл владелец.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return bad("no_id");
  const { data: p } = await supabaseAdmin.from("business_profiles").select(BIZ_COLS).eq("id", id).maybeSingle();
  if (!p) return bad("not_found", 404);
  const mine = (p as any).user_id === uid;
  if (!mine && (!(p as any).is_active || (p as any).is_hidden)) return bad("not_found", 404);
  if (!mine && (p as any).country_id) {
    const cid = await countryOfUser(uid);
    if (cid && cid !== (p as any).country_id) return bad("not_found", 404);
  }
  return NextResponse.json({ ok: true, profile: publicBiz(p), mine });
}
