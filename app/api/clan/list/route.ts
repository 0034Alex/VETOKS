import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Сообщения клана своего региона (читаем на сервере: так имена и категории всегда подтягиваются без ошибок доступа).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "clan/list", 40, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const cat = ["teen", "main", "adult", "all"].includes(b.cat) ? (b.cat as string) : "main";

  const { data: u } = await supabaseAdmin.from("users").select("region_id, role, is_official").eq("id", uid).maybeSingle();
  if (!u?.region_id) return NextResponse.json({ ok: true, messages: [], memberCount: 0 });
  // «Все» категории — только сотрудникам и официальной странице
  const staff = ["moderator", "finance_admin", "super_admin"].includes(String((u as any).role)) || !!(u as any).is_official;
  const view = cat === "all" && !staff ? "main" : cat;

  let q = supabaseAdmin
    .from("region_clan_messages")
    .select("id, user_id, body, created_at, edited_at")
    .eq("region_id", u.region_id)
    .eq("is_hidden", false);
  if (view !== "all") q = q.eq("age_category", view);
  const { data: msgs, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return bad("failed", 500);
  const list = (msgs ?? []).slice().reverse();

  const ids = Array.from(new Set(list.map((m: any) => m.user_id as string)));
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await supabaseAdmin.from("users").select("id, first_name").in("id", ids);
    (us ?? []).forEach((x: any) => (names[x.id] = x.first_name || ""));
  }

  let cq = supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("region_id", u.region_id);
  if (view !== "all") cq = cq.eq("age_category", view);
  const { count } = await cq;

  return NextResponse.json({
    ok: true,
    messages: list.map((m: any) => ({ id: m.id, user_id: m.user_id, body: m.body, created_at: m.created_at, edited_at: m.edited_at, name: names[m.user_id] || null })),
    memberCount: count ?? 0,
  });
}
