import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { botForUser } from "@/lib/countryBot";
import { stage1Ready } from "@/lib/orderFlow";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const DAY = 86400000;

// Оплата и менеджер магазина, учёт работы за последние 30 дней. Только для владельца магазина.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = String(b.action ?? "get");
  if (!(await stage1Ready())) return NextResponse.json({ ok: true, unavailable: true });

  const { data: bp0 } = await supabaseAdmin.from("business_profiles").select("id, pay_text, manager_tg_name, manager_tg_id, manager_code").eq("user_id", uid).maybeSingle();
  const bp: any = bp0;
  if (!bp) return bad("no_business", 404);
  const bot = await botForUser(uid);
  const view = (x: any) => ({
    pay_text: x.pay_text ?? "",
    manager: {
      name: x.manager_tg_name ?? "",
      bound: !!x.manager_tg_id,
      link: x.manager_code && bot.username ? `https://t.me/${bot.username}?start=bm_${x.manager_code}` : "",
      noBot: !bot.username,
    },
  });

  if (a === "get") return NextResponse.json({ ok: true, ...view(bp) });

  if (a === "save" || a === "regen" || a === "unlink") {
    const rl = await rateLimit(req, "business/settings", 60, 3600, uid);
    if (rl) return rl;
    const patch: Record<string, any> = {};
    if (a === "save" && b.pay_text !== undefined) patch.pay_text = s(b.pay_text, 600) || null;
    if (a === "unlink") {
      patch.manager_tg_name = null;
      patch.manager_tg_id = null;
      patch.manager_code = null;
    } else if (a === "regen") {
      if (!bp.manager_tg_name) return bad("no_manager");
      patch.manager_tg_id = null;
      patch.manager_code = randomBytes(12).toString("hex");
    } else if (b.manager !== undefined) {
      const nm = s(b.manager, 60).replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
      if (!nm) {
        patch.manager_tg_name = null;
        patch.manager_tg_id = null;
        patch.manager_code = null;
      } else {
        if (!/^[A-Za-z0-9_]{4,32}$/.test(nm)) return bad("bad_tg");
        patch.manager_tg_name = nm;
        patch.manager_tg_id = null;
        patch.manager_code = randomBytes(12).toString("hex");
      }
    }
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("business_profiles").update(patch).eq("id", bp.id);
      if (error) return bad("failed", 500);
    }
    const { data: fresh } = await supabaseAdmin.from("business_profiles").select("id, pay_text, manager_tg_name, manager_tg_id, manager_code").eq("id", bp.id).maybeSingle();
    return NextResponse.json({ ok: true, ...view(fresh ?? bp) });
  }

  if (a === "stats") {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const { data: os } = await supabaseAdmin
      .from("business_orders")
      .select("id, kind, status, created_at, product_name, total, paid_ok_at, returned_at, disputed_at")
      .eq("business_id", bp.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    const orders = ((os as any[]) ?? []).filter((o) => o.kind !== "gift");
    const { data: ls } = await supabaseAdmin
      .from("business_order_log")
      .select("order_id, actor, actor_name, action, created_at")
      .eq("business_id", bp.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000);
    const logs = (ls as any[]) ?? [];

    const totals: Record<string, number> = { created: orders.length, new: 0, confirmed: 0, paid: 0, shipped: 0, done: 0, cancelled: 0, returned: 0, disputed: 0, revenue: 0 };
    for (const o of orders) {
      if (o.status in totals) totals[o.status]++;
      if (o.returned_at) totals.returned++;
      if (o.disputed_at) totals.disputed++;
      if (o.paid_ok_at && !o.returned_at && o.status !== "cancelled") totals.revenue += Number(o.total) || 0;
    }
    totals.revenue = Math.round(totals.revenue * 100) / 100;

    type Row = { name: string; role: string; handled: number; approve: number; decline: number; paid: number; nopaid: number; ship: number; times: number[] };
    const rows: Record<string, Row> = {};
    const row = (role: string, name: string): Row => {
      const k = role + "|" + name;
      if (!rows[k]) rows[k] = { name, role, handled: 0, approve: 0, decline: 0, paid: 0, nopaid: 0, ship: 0, times: [] };
      return rows[k];
    };
    const created: Record<string, number> = {};
    orders.forEach((o) => (created[o.id] = new Date(o.created_at).getTime()));
    const answered: Record<string, boolean> = {};
    for (const l of logs) {
      if (l.actor === "buyer") continue;
      const r = row(l.actor, l.actor_name || (l.actor === "manager" ? "Менеджер" : "Владелец"));
      r.handled++;
      if (l.action === "approve") r.approve++;
      if (l.action === "decline") r.decline++;
      if (l.action === "paid") r.paid++;
      if (l.action === "nopaid") r.nopaid++;
      if (l.action === "ship") r.ship++;
      if (["approve", "decline", "cancel"].includes(l.action) && created[l.order_id] && !answered[l.order_id]) {
        answered[l.order_id] = true;
        r.times.push(Math.max(0, Math.round((new Date(l.created_at).getTime() - created[l.order_id]) / 60000)));
      }
    }
    const actors = Object.values(rows).map((r) => ({
      name: r.name,
      role: r.role,
      handled: r.handled,
      approve: r.approve,
      decline: r.decline,
      paid: r.paid,
      nopaid: r.nopaid,
      ship: r.ship,
      avgMin: r.times.length ? Math.round(r.times.reduce((x: number, y: number) => x + y, 0) / r.times.length) : null,
    }));
    const waiting = orders
      .filter((o) => o.status === "new")
      .map((o) => ({ id: o.id, name: o.product_name, ageMin: Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) }))
      .filter((o) => o.ageMin >= 120)
      .slice(0, 20);
    return NextResponse.json({ ok: true, totals, actors, waiting });
  }

  return bad("bad_action");
}
