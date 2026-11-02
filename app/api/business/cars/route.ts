import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { carsReady, loadCars } from "@/lib/carsServer";
import { MAX_CAR_PHOTOS } from "@/lib/carsShared";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const num = (v: any): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
  return isFinite(n) ? n : null;
};

// Автомобили бизнеса: правит только владелец. Удалять нельзя, только скрывать или отметить «Продано».
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "list");
  if (!(await carsReady())) return NextResponse.json({ ok: true, unavailable: true, items: [] });
  const { data: bp } = await supabaseAdmin.from("business_profiles").select("id").eq("user_id", uid).maybeSingle();
  if (!bp) return bad("no_business", 404);
  const bid = String((bp as any).id);

  if (a === "list") return NextResponse.json({ ok: true, items: await loadCars(bid, false) });

  if (a === "save") {
    const rl = await rateLimit(req, "business/cars", 120, 3600, uid);
    if (rl) return rl;
    const make = s(b.make, 40);
    const model = s(b.model, 60);
    if (!make || !model) return bad("empty_name");
    const price = num(b.price);
    if (price === null || price < 0 || price > 1000000000) return bad("bad_price");
    const year = num(b.year);
    if (year !== null && (year < 1950 || year > new Date().getFullYear() + 1)) return bad("bad_year");
    const photos = (Array.isArray(b.photos) ? b.photos : []).map((x: any) => s(x, 500)).filter(Boolean).slice(0, MAX_CAR_PHOTOS);
    const row = {
      business_id: bid,
      make,
      model,
      year: year === null ? null : Math.round(year),
      mileage_km: num(b.mileage_km) === null ? null : Math.max(0, Math.round(num(b.mileage_km) as number)),
      body: s(b.body, 30) || null,
      engine_vol: num(b.engine_vol),
      fuel: s(b.fuel, 30) || null,
      gearbox: s(b.gearbox, 30) || null,
      drive: s(b.drive, 30) || null,
      vin: s(b.vin, 20).toUpperCase() || null,
      features: (Array.isArray(b.features) ? b.features : []).map((x: any) => s(x, 40)).filter(Boolean).slice(0, 30),
      price,
      currency: ["USD", "EUR", "UAH"].includes(String(b.currency)) ? String(b.currency) : "USD",
      negotiable: !!b.negotiable,
      description: s(b.description, 2000) || null,
      photos,
      status: ["available", "reserved", "sold"].includes(String(b.status)) ? String(b.status) : "available",
      is_active: b.is_active !== false,
    };
    if (b.id) {
      const { error } = await supabaseAdmin.from("business_cars").update(row).eq("id", s(b.id, 60)).eq("business_id", bid);
      if (error) return bad("failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("business_cars").insert(row);
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true, items: await loadCars(bid, false) });
  }

  return bad("bad_action");
}
