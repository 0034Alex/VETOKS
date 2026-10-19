import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { regionIdsOfCountry } from "@/lib/countryServer";
import { kyivDate, kyivDayStartUtc, addDays } from "@/lib/kyiv";

export const dynamic = "force-dynamic";

async function cnt(q: PromiseLike<{ count: number | null }>) {
  const r = await q;
  return r.count ?? 0;
}

export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const period = String(body.period ?? "7d");
  const region = body.regionId ? String(body.regionId) : null;
  const country = body.countryId ? String(body.countryId) : null;
  const rids = country ? await regionIdsOfCountry(country) : [];

  const today = kyivDate();
  let from: Date;
  if (period === "today") from = kyivDayStartUtc(today);
  else if (period === "30d") from = kyivDayStartUtc(addDays(today, -29));
  else if (period === "all") from = new Date("2000-01-01T00:00:00Z");
  else from = kyivDayStartUtc(addDays(today, -6));

  const { data: stats } = await supabaseAdmin.rpc("vt_dash", {
    p_from: from.toISOString(),
    p_region: region,
    p_country: country,
  });

  const attention = {
    applications: await cnt(
      country
        ? supabaseAdmin.from("applications").select("id, users!inner(region_id)", { count: "exact", head: true }).eq("status", "submitted").in("users.region_id", rids)
        : supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).eq("status", "submitted")
    ),
    reports: await cnt(supabaseAdmin.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    tasks: await cnt(
      country
        ? supabaseAdmin.from("task_completions").select("id, participants!inner(region_id)", { count: "exact", head: true }).eq("status", "pending").in("participants.region_id", rids)
        : supabaseAdmin.from("task_completions").select("id", { count: "exact", head: true }).eq("status", "pending")
    ),
    partners: await cnt(
      supabaseAdmin.from("sponsors").select("id", { count: "exact", head: true }).lte("follow_up_at", today).not("stage", "in", "(done,lost)")
    ),
    support: await cnt(supabaseAdmin.from("support_requests").select("id", { count: "exact", head: true }).neq("status", "done")),
  };

  const pwa = await cnt(supabaseAdmin.from("pwa_installs").select("id", { count: "exact", head: true }));

  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const pwa7 = await cnt(supabaseAdmin.from("pwa_installs").select("id", { count: "exact", head: true }).gte("last_seen", since7));
  return NextResponse.json({ ok: true, stats: stats ?? {}, attention, pwa, pwa7 });
}
