import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Публичная лента «Живая Фан-Зона»: последние дорогие покупки за 3 суток.
export async function GET() {
  const { data: st } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "fanzone_enabled")
    .maybeSingle();
  if (st?.value === "false") return NextResponse.json({ enabled: false, items: [] });

  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data } = await supabaseAdmin
    .from("fan_feed")
    .select("id, created_at, sender_name, participant_id, participant_name, kind, label, amount")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  return NextResponse.json({ enabled: true, items: data ?? [] });
}
