import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { BIZ_COLS, publicBiz } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Список включённых бизнес-страниц своей страны (для раздела «Партнёры»).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const cid = await countryOfUser(uid);
  let q = supabaseAdmin.from("business_profiles").select(BIZ_COLS).eq("is_active", true).eq("is_hidden", false).order("created_at", { ascending: false }).limit(100);
  if (cid) q = q.or(`country_id.is.null,country_id.eq.${cid}`);
  const { data } = await q;
  return NextResponse.json({ ok: true, items: (data ?? []).map(publicBiz) });
}
