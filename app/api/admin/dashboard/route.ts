import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
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

  const today = kyivDate();
  let from: Date;
  if (period === "today") from = kyivDayStartUtc(today);
  else if (period === "30d") from = kyivDayStartUtc(addDays(today, -29));
  else if (period === "all") from = new Date("2000-01-01T00:00:00Z");
  else from = kyivDayStartUtc(addDays(today, -6));

  const { data: stats } = await supabaseAdmin.rpc("vt_dash", {
    p_from: from.toISOString(),
    p_region: region,
  });

  const attention = {
    applications: await cnt(supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).eq("status", "submitted")),
    reports: await cnt(supabaseAdmin.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    tasks: await cnt(supabaseAdmin.from("task_completions").select("id", { count: "exact", head: true }).eq("status", "pending")),
    support: await cnt(supabaseAdmin.from("support_requests").select("id", { count: "exact", head: true }).neq("status", "done")),
  };

  const pwa = await cnt(supabaseAdmin.from("pwa_installs").select("id", { count: "exact", head: true }));

  return NextResponse.json({ ok: true, stats: stats ?? {}, attention, pwa });
}
