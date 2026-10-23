import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Объявления для главной: идут сейчас и подходят по возрастной категории человека.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const nowIso = new Date().toISOString();
  const [{ data }, { data: u }] = await Promise.all([
    supabaseAdmin
      .from("announcements")
      .select("id, title, body, ends_at, audience, show_timer, country_id, all_regions, region_ids")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin.from("users").select("age_category, region_id").eq("id", uid).maybeSingle(),
  ]);
  const mine = (u as any)?.age_category || "main";
  const myRegion = (u as any)?.region_id ? String((u as any).region_id) : null;
  const myCountry = await countryOfUser(uid);
  // Подходит по возрасту, по стране и по региону (пусто = всем).
  const items = ((data ?? []) as any[]).filter(
    (a) =>
      (!a.audience?.length || a.audience.includes(mine)) &&
      (!a.country_id || !myCountry || String(a.country_id) === String(myCountry)) &&
      (a.all_regions !== false || !(a.region_ids ?? []).length || (myRegion && (a.region_ids as string[]).map(String).includes(myRegion)))
  );
  return NextResponse.json({ ok: true, items });
}
