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

  // Много аккаунтов с одного адреса за последние дни: возможная накрутка.
  if (action === "clusters") {
    const days = Math.min(30, Math.max(1, Number(b.days) || 7));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("activity_ips")
      .select("user_id, ip, kind, participant_id, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000);
    const byIp = new Map<string, any[]>();
    (rows ?? []).forEach((r: any) => {
      const a = byIp.get(r.ip) ?? [];
      a.push(r);
      byIp.set(r.ip, a);
    });
    const groups = [...byIp.entries()]
      .map(([ip, list]) => ({ ip, list, users: new Set(list.map((r) => r.user_id)) }))
      .filter((g) => g.users.size >= 4)
      .sort((a, b2) => b2.users.size - a.users.size)
      .slice(0, 40);
    const userIds = [...new Set(groups.flatMap((g) => [...g.users]))].slice(0, 400);
    const partIds = [...new Set(groups.flatMap((g) => g.list.map((r) => r.participant_id).filter(Boolean)))].slice(0, 200);
    const { data: us } = userIds.length
      ? await supabaseAdmin.from("users").select("id, first_name, is_banned").in("id", userIds)
      : { data: [] as any[] };
    const { data: ps } = partIds.length
      ? await supabaseAdmin.from("participants").select("id, display_name").in("id", partIds as string[])
      : { data: [] as any[] };
    const uname: Record<string, any> = {};
    (us ?? []).forEach((u: any) => (uname[u.id] = u));
    const pname: Record<string, string> = {};
    (ps ?? []).forEach((p: any) => (pname[p.id] = p.display_name));
    const out = groups.map((g) => {
      const votesFor: Record<string, number> = {};
      g.list.forEach((r) => {
        if (r.kind === "vote" && r.participant_id) votesFor[r.participant_id] = (votesFor[r.participant_id] ?? 0) + 1;
      });
      return {
        ip: g.ip,
        accounts: [...g.users].map((id) => ({ id, name: uname[id]?.first_name ?? "—", banned: !!uname[id]?.is_banned })),
        kinds: [...new Set(g.list.map((r) => r.kind))],
        votesFor: Object.entries(votesFor)
          .map(([id, n]) => ({ name: pname[id] ?? "—", n }))
          .sort((a, b2) => b2.n - a.n)
          .slice(0, 5),
      };
    });
    return NextResponse.json({ ok: true, clusters: out });
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
