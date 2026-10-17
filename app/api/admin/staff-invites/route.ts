import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { newToken } from "@/lib/authServer";

export const dynamic = "force-dynamic";

const PERM_KEYS = ["today", "people", "contest", "content", "mod", "money", "ads", "set"];
const ROLES = ["moderator", "finance_admin"];

// Приглашения сотрудников. Только владелец.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  if (action === "list") {
    const { data } = await supabaseAdmin
      .from("staff_invites")
      .select("id, token, email, name, role, permissions, countries, created_at, expires_at, used_at, revoked")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (action === "revoke") {
    await supabaseAdmin.from("staff_invites").update({ revoked: true }).eq("id", String(b.id || ""));
    await logAction(uid, "staff_invite_revoke", null, { id: b.id });
    return NextResponse.json({ ok: true });
  }

  if (action === "create") {
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
    const role = ROLES.includes(b.role) ? b.role : "moderator";
    const permissions: Record<string, string> = {};
    for (const k of PERM_KEYS) {
      const v = b.permissions?.[k];
      if (v === "r" || v === "w") permissions[k] = v;
    }
    if (Object.keys(permissions).length === 0) return NextResponse.json({ ok: false, error: "no_permissions" }, { status: 400 });
    const countries = Array.isArray(b.countries) && b.countries.length > 0 ? b.countries.map(String) : null;
    const token = newToken();
    const expires = new Date(Date.now() + 3 * 86400_000).toISOString();
    const { error } = await supabaseAdmin.from("staff_invites").insert({
      token,
      email,
      name: String(b.name || "").trim().slice(0, 60) || null,
      role,
      permissions,
      countries,
      created_by: uid,
      expires_at: expires,
    });
    if (error) return NextResponse.json({ ok: false, error: "server", detail: error.message }, { status: 500 });
    await logAction(uid, "staff_invite_create", null, { email, role, permissions, countries });
    return NextResponse.json({ ok: true, token });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
