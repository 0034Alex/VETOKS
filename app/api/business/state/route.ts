import { NextResponse } from "next/server";
import { bad, requireUser } from "@/lib/shopServer";
import { businessContext } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

// Для переключателя «Личный / Бизнес»: можно ли этому человеку бизнес-режим и где он сейчас.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const c = await businessContext(uid);
  if (!c) return bad("no_user", 404);
  const eligible = !!c.sponsor || !!c.profile;
  const own = c.profile && c.profile.user_id === uid ? c.profile : null;
  return NextResponse.json({
    ok: true,
    eligible,
    hasBusiness: !!c.profile,
    isBusinessNow: !!c.profile && c.profile.user_id === uid,
    businessUserId: c.profile?.user_id ?? null,
    rootId: c.rootId,
    sponsorName: c.sponsor?.name ?? null,
    profile: own, // полные данные только владельцу
  });
}
