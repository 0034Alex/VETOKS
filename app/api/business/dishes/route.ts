import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { foodReady, loadDishes, cleanMods } from "@/lib/foodServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

// Меню: правит только владелец. Удалять нельзя, блюдо скрывается или уходит в стоп-лист.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "list");
  if (!(await foodReady())) return NextResponse.json({ ok: true, unavailable: true, items: [] });
  const { data: bp } = await supabaseAdmin.from("business_profiles").select("id").eq("user_id", uid).maybeSingle();
  if (!bp) return bad("no_business", 404);
  const bid = String((bp as any).id);

  if (a === "list") return NextResponse.json({ ok: true, items: await loadDishes(bid, false) });

  if (a === "save") {
    const rl = await rateLimit(req, "business/dishes", 200, 3600, uid);
    if (rl) return rl;
    const name = s(b.name, 100);
    if (!name) return bad("empty_name");
    const price = Number(String(b.price).replace(",", "."));
    if (!isFinite(price) || price < 0 || price > 1000000) return bad("bad_price");
    const row = {
      business_id: bid,
      name,
      description: s(b.description, 500) || null,
      weight: s(b.weight, 30) || null,
      price,
      category: s(b.category, 40) || null,
      photo_url: s(b.photo_url, 500) || null,
      modifiers: cleanMods(b.modifiers),
      in_stock: b.in_stock !== false,
      is_active: b.is_active !== false,
    };
    if (b.id) {
      const { error } = await supabaseAdmin.from("business_dishes").update(row).eq("id", s(b.id, 60)).eq("business_id", bid);
      if (error) return bad("failed", 500);
    } else {
      const { error } = await supabaseAdmin.from("business_dishes").insert(row);
      if (error) return bad("failed", 500);
    }
    return NextResponse.json({ ok: true, items: await loadDishes(bid, false) });
  }

  return bad("bad_action");
}
