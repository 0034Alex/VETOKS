import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// «Мой магазин»: любой человек может выбрать магазин на платформе, и ссылка на него появится у него в профиле.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "get");

  const q = await supabaseAdmin.from("users").select("shop_business_id").eq("id", uid).maybeSingle();
  // Если SQL ещё не выполнен, колонки нет: просто говорим, что магазин не выбран.
  const columnOk = !q.error;
  const curId = columnOk ? ((q.data as any)?.shop_business_id as string | null) : null;

  if (action === "set") {
    if (!columnOk) return bad("no_column", 500);
    const rl = await rateLimit(req, "business/myshop", 30, 3600, uid);
    if (rl) return rl;
    const id = b.businessId ? String(b.businessId) : "";
    if (id) {
      const { data: p } = await supabaseAdmin.from("business_profiles").select("id, country_id, is_active, is_hidden").eq("id", id).maybeSingle();
      if (!p || !(p as any).is_active || (p as any).is_hidden) return bad("not_found", 404);
      const cid = await countryOfUser(uid);
      if (cid && (p as any).country_id && (p as any).country_id !== cid) return bad("not_found", 404);
    }
    const { error } = await supabaseAdmin.from("users").update({ shop_business_id: id || null }).eq("id", uid);
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true, shop: id ? await shopCard(id) : null });
  }

  return NextResponse.json({ ok: true, columnOk, shop: curId ? await shopCard(curId) : null });
}

async function shopCard(id: string) {
  const { data: p } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, logo_url, is_active, is_hidden").eq("id", id).maybeSingle();
  if (!p || !(p as any).is_active || (p as any).is_hidden) return null;
  return { id: (p as any).id, user_id: (p as any).user_id, name: (p as any).name, logo_url: (p as any).logo_url ?? null };
}
