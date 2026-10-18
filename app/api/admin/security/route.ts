import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

// CRM → Безопасность: кто сейчас заблокирован, журнал подозрительных действий, снятие блокировок.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "list");

  if (action === "list") {
    const now = new Date().toISOString();
    const { data: locks } = await supabaseAdmin
      .from("auth_locks")
      .select("key, fails, level, blocked_until, updated_at")
      .gt("blocked_until", now)
      .order("blocked_until", { ascending: false })
      .limit(200);
    const days = Math.min(30, Math.max(1, Number(b.days) || 3));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    let q = supabaseAdmin
      .from("security_events")
      .select("id, kind, ip, user_id, detail, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    if (b.kind) q = q.eq("kind", String(b.kind));
    const { data: events } = await q;
    return NextResponse.json({ ok: true, locks: locks ?? [], events: events ?? [] });
  }

  if (action === "unblock") {
    const key = String(b.key ?? "");
    if (!key) return NextResponse.json({ ok: false }, { status: 400 });
    await supabaseAdmin.from("auth_locks").delete().eq("key", key);
    await logAction(uid, "security_unblock", null, { key: key.slice(0, 120) });
    return NextResponse.json({ ok: true });
  }

  // Снять все блокировки по логину/почте/номеру или по IP: ищем по части ключа.
  if (action === "unblock_search") {
    const q = String(b.q ?? "").trim().toLowerCase().replace(/[%,()]/g, "");
    if (q.length < 3) return NextResponse.json({ ok: false, error: "short" }, { status: 400 });
    const { data } = await supabaseAdmin.from("auth_locks").select("key").ilike("key", `%${q}%`).limit(200);
    const keys = (data ?? []).map((r: any) => r.key);
    if (keys.length) await supabaseAdmin.from("auth_locks").delete().in("key", keys);
    await logAction(uid, "security_unblock", null, { search: q.slice(0, 80), count: keys.length });
    return NextResponse.json({ ok: true, count: keys.length });
  }

  if (action === "unblock_all") {
    await supabaseAdmin.from("auth_locks").delete().neq("key", "");
    await logAction(uid, "security_unblock", null, { all: true });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
