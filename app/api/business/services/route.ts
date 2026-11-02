import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { bookingReady, loadCatalog, toMin, validDate } from "@/lib/bookingServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

// Услуги и мастера: правит только владелец. Удалять нельзя, только скрывать.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "list");
  if (!(await bookingReady())) return NextResponse.json({ ok: true, unavailable: true });
  const { data: bp } = await supabaseAdmin.from("business_profiles").select("id").eq("user_id", uid).maybeSingle();
  if (!bp) return bad("no_business", 404);
  const bid = String((bp as any).id);

  if (a === "list") {
    const cat = await loadCatalog(bid, false);
    return NextResponse.json({ ok: true, ...cat });
  }

  const rl = await rateLimit(req, "business/services", 120, 3600, uid);
  if (rl) return rl;

  if (a === "master_save") {
    const name = s(b.name, 60);
    if (!name) return bad("empty_name");
    const st = s(b.start_time, 5);
    const en = s(b.end_time, 5);
    if (isNaN(toMin(st)) || isNaN(toMin(en)) || toMin(en) <= toMin(st)) return bad("bad_time");
    const days = (Array.isArray(b.work_days) ? b.work_days : []).map(Number).filter((x: number) => x >= 1 && x <= 7);
    const off = (Array.isArray(b.days_off) ? b.days_off : []).map(String).filter(validDate).slice(0, 120);
    const slot = [15, 20, 30, 45, 60, 90, 120].includes(Number(b.slot_min)) ? Number(b.slot_min) : 30;
    const row = { business_id: bid, name, role: s(b.role, 60) || null, photo_url: s(b.photo_url, 500) || null, work_days: Array.from(new Set(days)), start_time: st, end_time: en, slot_min: slot, days_off: off, is_active: b.is_active !== false };
    if (b.id) {
      const { error } = await supabaseAdmin.from("business_masters").update(row).eq("id", s(b.id, 60)).eq("business_id", bid);
      if (error) return bad("failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("business_masters").insert(row);
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true, ...(await loadCatalog(bid, false)) });
  }

  if (a === "service_save") {
    const name = s(b.name, 100);
    if (!name) return bad("empty_name");
    const price = Number(b.price);
    if (!isFinite(price) || price < 0 || price > 10000000) return bad("bad_price");
    const dur = Math.floor(Number(b.duration_min));
    if (!(dur >= 5 && dur <= 720)) return bad("bad_duration");
    const { data: ms } = await supabaseAdmin.from("business_masters").select("id").eq("business_id", bid);
    const mine = new Set(((ms as any[]) ?? []).map((x) => String(x.id)));
    const ids = (Array.isArray(b.master_ids) ? b.master_ids : []).map(String).filter((x: string) => mine.has(x));
    const row = { business_id: bid, name, category: s(b.category, 60) || null, price, duration_min: dur, description: s(b.description, 600) || null, master_ids: ids, is_active: b.is_active !== false };
    if (b.id) {
      const { error } = await supabaseAdmin.from("business_services").update(row).eq("id", s(b.id, 60)).eq("business_id", bid);
      if (error) return bad("failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("business_services").insert(row);
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true, ...(await loadCatalog(bid, false)) });
  }

  return bad("bad_action");
}
