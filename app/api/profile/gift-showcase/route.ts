import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Витрина подарков в профиле: что и сколько человеку подарили (без имён дарителей).
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const target = String(b.userId || me);
  const self = target === me;
  if (!self && !(await sameCountry(me, target))) return bad("not_found", 404);

  const { data: u } = await supabaseAdmin.from("users").select("privacy").eq("id", target).maybeSingle();
  const hidden = ((u?.privacy as any) ?? {}).gifts === false;
  if (hidden && !self) return NextResponse.json({ ok: true, show: false, total: 0, items: [] });

  const { data } = await supabaseAdmin.from("user_gifts").select("gift_name, quantity").eq("recipient_id", target).limit(5000);
  const map: Record<string, number> = {};
  (data ?? []).forEach((r: any) => (map[r.gift_name] = (map[r.gift_name] ?? 0) + Number(r.quantity || 1)));
  const items = Object.entries(map)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b2) => b2.qty - a.qty);
  const total = items.reduce((s, i) => s + i.qty, 0);
  return NextResponse.json({ ok: true, show: total > 0, hidden: hidden && self, total, items });
}
