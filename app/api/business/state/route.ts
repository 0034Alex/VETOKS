import { NextResponse } from "next/server";
import { bad, requireUser } from "@/lib/shopServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { businessContext, currencyOfCountry } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Для переключателя «Личный / Бизнес»: можно ли этому человеку бизнес-режим и где он сейчас.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const c = await businessContext(uid);
  if (!c) return bad("no_user", 404);
  const eligible = !!c.sponsor || !!c.profile;
  const own = c.profile && c.profile.user_id === uid ? c.profile : null;
  let newOrders = 0;
  if (own) {
    try {
      const { count } = await supabaseAdmin.from("business_orders").select("id", { count: "exact", head: true }).eq("business_id", own.id).eq("status", "new");
      newOrders = count ?? 0;
    } catch {}
  }
  return NextResponse.json({
    ok: true,
    eligible,
    hasBusiness: !!c.profile,
    isBusinessNow: !!c.profile && c.profile.user_id === uid,
    businessId: c.profile?.id ?? null,
    newOrders,
    businessUserId: c.profile?.user_id ?? null,
    rootId: c.rootId,
    sponsorName: c.sponsor?.name ?? null,
    profile: own, // полные данные только владельцу
    cur: own ? await currencyOfCountry(own.country_id) : "₴",
  });
}
