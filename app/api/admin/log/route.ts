import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

// Журнал действий персонала — только главный админ.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));

  const days = Math.min(Math.max(Number(body.days) || 7, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let q = supabaseAdmin
    .from("admin_log")
    .select("id, actor_id, action, target_id, meta, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (body.actor) q = q.eq("actor_id", String(body.actor));
  if (body.action) q = q.eq("action", String(body.action));
  const { data } = await q;
  const rows = data ?? [];

  const ids = Array.from(new Set(rows.flatMap((r: any) => [r.actor_id, r.target_id]).filter(Boolean)));
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await supabaseAdmin.from("users").select("id, first_name, username").in("id", ids);
    (us ?? []).forEach((u: any) => (names[u.id] = u.first_name || u.username || "Без имени"));
  }

  // Для фильтров: сотрудники и типы действий за выбранный период.
  const { data: all } = await supabaseAdmin
    .from("admin_log")
    .select("actor_id, action")
    .gte("created_at", since)
    .limit(2000);
  const actorIds = Array.from(new Set((all ?? []).map((r: any) => r.actor_id).filter(Boolean)));
  const actions = Array.from(new Set((all ?? []).map((r: any) => r.action)));
  const actors: { id: string; name: string }[] = [];
  if (actorIds.length) {
    const { data: us } = await supabaseAdmin.from("users").select("id, first_name, username").in("id", actorIds);
    (us ?? []).forEach((u: any) => actors.push({ id: u.id, name: u.first_name || u.username || "Без имени" }));
  }

  return NextResponse.json({
    ok: true,
    rows: rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      meta: r.meta ?? {},
      created_at: r.created_at,
      actor: r.actor_id ? names[r.actor_id] ?? "—" : "—",
      target: r.target_id ? names[r.target_id] ?? "—" : null,
    })),
    actors,
    actions,
  });
}
