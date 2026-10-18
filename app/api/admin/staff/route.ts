import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { killSessions } from "@/lib/security";

export const dynamic = "force-dynamic";

const ROLES = ["viewer", "ambassador", "moderator", "finance_admin", "super_admin"];

// Всё, что CRM делает с ролями, правами и блокировками людей.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  const isSuper = me?.role === "super_admin";
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");

  // Список людей для вкладки «Персонал» — только владелец.
  if (action === "list") {
    if (!isSuper) return NextResponse.json({ ok: false }, { status: 403 });
    const { data } = await supabaseAdmin.from("users").select("id, first_name, role, permissions").limit(1000);
    return NextResponse.json({ ok: true, users: data ?? [] });
  }

  // Блокировка и вход в последний раз для таблицы участниц.
  if (action === "flags") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 1000);
    if (!ids.length) return NextResponse.json({ ok: true, flags: {} });
    const { data } = await supabaseAdmin.from("users").select("id, is_banned, last_login_at").in("id", ids);
    const flags: Record<string, { is_banned: boolean; last_login_at: string | null }> = {};
    (data ?? []).forEach((u: any) => (flags[u.id] = { is_banned: !!u.is_banned, last_login_at: u.last_login_at }));
    return NextResponse.json({ ok: true, flags });
  }

  if (action === "ban") {
    const target = String(b.userId ?? "");
    if (!target || target === uid) return NextResponse.json({ ok: false, error: "bad_target" }, { status: 400 });
    const { data: t } = await supabaseAdmin.from("users").select("role").eq("id", target).maybeSingle();
    // Сотрудника блокирует только владелец.
    if (t && ["moderator", "finance_admin", "super_admin"].includes(t.role) && !isSuper)
      return NextResponse.json({ ok: false }, { status: 403 });
    const value = !!b.value;
    await supabaseAdmin.from("users").update({ is_banned: value }).eq("id", target);
    if (value) await killSessions(target);
    await logAction(uid, value ? "user_ban" : "user_unban", target);
    return NextResponse.json({ ok: true });
  }

  if (action === "role" || action === "permission") {
    if (!isSuper) return NextResponse.json({ ok: false }, { status: 403 });
    const target = String(b.userId ?? "");
    if (!target) return NextResponse.json({ ok: false }, { status: 400 });
    if (action === "role") {
      const role = String(b.role ?? "");
      if (!ROLES.includes(role)) return NextResponse.json({ ok: false, error: "bad_role" }, { status: 400 });
      // Себе роль менять нельзя: чтобы не остаться без владельца.
      if (target === uid) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });
      await supabaseAdmin.from("users").update({ role }).eq("id", target);
      await logAction(uid, "user_role", target, { role });
    } else {
      const key = String(b.key ?? "").slice(0, 40);
      if (!key) return NextResponse.json({ ok: false }, { status: 400 });
      const { data: t } = await supabaseAdmin.from("users").select("permissions").eq("id", target).maybeSingle();
      const updated = { ...((t?.permissions as Record<string, unknown>) ?? {}), [key]: !!b.value };
      await supabaseAdmin.from("users").update({ permissions: updated }).eq("id", target);
      await logAction(uid, "user_permission", target, { key, value: !!b.value });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
