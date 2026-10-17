import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { countryOfRegion } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Перенос человека (и его анкеты участницы) в другую страну. Только сотрудник из CRM.
// Регион он потом выбирает сам в профиле — но только среди регионов новой страны.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const userId = String(b.userId || "");
  const countryId = String(b.countryId || "");
  if (!userId || !countryId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const { data: me } = await supabaseAdmin.from("users").select("role, staff_countries").eq("id", uid).maybeSingle();
  const allowed: string[] | null = me?.role === "super_admin" ? null : Array.isArray(me?.staff_countries) ? (me!.staff_countries as string[]) : null;

  const { data: target } = await supabaseAdmin.from("users").select("id, region_id, role").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ ok: false, error: "no_user" }, { status: 404 });
  if (target.role === "super_admin" && me?.role !== "super_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const fromCountry = await countryOfRegion(target.region_id as string | null);
  if (allowed && ((fromCountry && !allowed.includes(fromCountry)) || !allowed.includes(countryId))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (fromCountry === countryId) return NextResponse.json({ ok: true, unchanged: true });

  const { data: country } = await supabaseAdmin.from("countries").select("id, name").eq("id", countryId).maybeSingle();
  if (!country) return NextResponse.json({ ok: false, error: "no_country" }, { status: 404 });
  // Пока человек не выберет свой регион, он числится в первом регионе новой страны.
  const { data: reg } = await supabaseAdmin.from("regions").select("id").eq("country_id", countryId).order("name").limit(1).maybeSingle();
  if (!reg) return NextResponse.json({ ok: false, error: "no_regions" }, { status: 409 });

  const { error } = await supabaseAdmin
    .from("users")
    .update({ region_id: reg.id, region_changed_at: null, region_pending: true })
    .eq("id", userId);
  if (error) return NextResponse.json({ ok: false, error: "server", detail: error.message }, { status: 500 });

  const upd: Record<string, unknown> = { region_id: reg.id };
  const { data: season } = await supabaseAdmin.from("seasons").select("id").eq("country_id", countryId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (season) upd.season_id = season.id;
  await supabaseAdmin.from("participants").update(upd).eq("user_id", userId);

  await logAction(uid, "change_country", userId, { from: fromCountry, to: countryId, toName: country.name });
  return NextResponse.json({ ok: true, countryName: country.name });
}
