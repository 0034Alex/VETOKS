import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Объявления для главной: идут сейчас и подходят по возрастной категории человека.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const nowIso = new Date().toISOString();
  const [{ data }, { data: u }] = await Promise.all([
    supabaseAdmin
      .from("announcements")
      .select("id, title, body, ends_at, audience, show_timer")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin.from("users").select("age_category").eq("id", uid).maybeSingle(),
  ]);
  const mine = (u as any)?.age_category || "main";
  const items = ((data ?? []) as any[]).filter((a) => !a.audience?.length || a.audience.includes(mine));
  return NextResponse.json({ ok: true, items });
}
