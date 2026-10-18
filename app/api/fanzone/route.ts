import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { countryOfUser, regionIdsOfCountry, settingsForCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// «Живая Фан-Зона»: каждый видит покупки своего региона за 3 суток.
// Когда сезон в статусе «final» (гранд-финал) — показываем всю страну.
export async function GET(req: Request) {
  const uid0 = await userIdFromBearer(req);
  const cid0 = uid0 ? await countryOfUser(uid0) : null;
  const st = await settingsForCountry(["fanzone_enabled"], cid0);
  if (st.fanzone_enabled === "false") return NextResponse.json({ enabled: false, items: [] });

  let seQ = supabaseAdmin.from("seasons").select("status").order("created_at", { ascending: false }).limit(1);
  if (cid0) seQ = seQ.eq("country_id", cid0);
  const { data: season } = await seQ.maybeSingle();
  const grand = season?.status === "final";

  let regionId: string | null = null;
  let countryRegions: string[] | null = null;
  if (grand) {
    // На гранд-финале — вся страна, но только своя.
    if (!cid0) return NextResponse.json({ enabled: true, items: [] });
    countryRegions = await regionIdsOfCountry(cid0);
  }
  if (!grand) {
    const uid = await userIdFromBearer(req);
    if (uid) {
      const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
      regionId = (u?.region_id as string) ?? null;
    }
    if (!regionId) return NextResponse.json({ enabled: true, items: [] });
  }

  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  let q = supabaseAdmin
    .from("fan_feed")
    .select("id, created_at, sender_name, participant_id, participant_name, kind, label, amount")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  if (regionId) q = q.eq("region_id", regionId);
  else if (countryRegions) q = q.in("region_id", countryRegions);
  const { data } = await q;
  return NextResponse.json({ enabled: true, items: data ?? [] });
}
