import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Первый вход сотрудника: придумывает пароль, получает свой доступ.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "");
  const password = String(b.password || "");
  if (!token || password.length < 8) return NextResponse.json({ ok: false, error: "short_password" }, { status: 400 });

  const { data: inv } = await supabaseAdmin.from("staff_invites").select("*").eq("token", token).maybeSingle();
  if (!inv || inv.revoked || inv.used_at || new Date(inv.expires_at as string).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "bad_link" }, { status: 404 });
  }
  const email = String(inv.email).toLowerCase();

  // Есть ли уже такой человек (обычный пользователь или сотрудник, забывший пароль).
  const { data: existing } = await supabaseAdmin.from("users").select("id, role").ilike("email", email).limit(1).maybeSingle();
  let userId: string;
  if (existing) {
    userId = existing.id as string;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) return NextResponse.json({ ok: false, error: "server", detail: error.message }, { status: 500 });
    // Владельца приглашение не трогает: только пароль, роль и права остаются.
    if (existing.role !== "super_admin") {
      await supabaseAdmin
        .from("users")
        .update({ role: inv.role, permissions: inv.permissions, staff_countries: inv.countries })
        .eq("id", userId);
    }
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !created?.user) return NextResponse.json({ ok: false, error: "server", detail: error?.message }, { status: 500 });
    userId = created.user.id;
    const { error: insErr } = await supabaseAdmin.from("users").insert({
      id: userId,
      first_name: inv.name || email.split("@")[0],
      email,
      role: inv.role,
      permissions: inv.permissions,
      staff_countries: inv.countries,
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ ok: false, error: "server", detail: insErr.message }, { status: 500 });
    }
  }
  await supabaseAdmin.from("staff_invites").update({ used_at: new Date().toISOString() }).eq("id", inv.id);
  await supabaseAdmin.from("admin_log").insert({ actor_id: userId, action: "staff_invite_accept", target_id: userId, meta: { email } });
  return NextResponse.json({ ok: true, email });
}
