import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// «Живая Фан-Зона»: каждый видит покупки своего региона за 3 суток.
// Когда сезон в статусе «final» (гранд-финал) — показываем всю страну.
export async function GET(req: Request) {
  const { data: st } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "fanzone_enabled")
    .maybeSingle();
  if (st?.value === "false") return NextResponse.json({ enabled: false, items: [] });

  const { data: season } = await supabaseAdmin
    .from("seasons")
    .select("status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const grand = season?.status === "final";

  let regionId: string | null = null;
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
  const { data } = await q;
  return NextResponse.json({ enabled: true, items: data ?? [] });
}
