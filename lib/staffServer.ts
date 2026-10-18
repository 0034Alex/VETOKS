import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { logSecurity } from "@/lib/security";

// Проверка «это сотрудник CRM». roles — кому разрешено.
export async function requireStaff(
  req: Request,
  roles: string[] = ["moderator", "finance_admin", "super_admin"]
): Promise<string | NextResponse> {
  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  if (!data || !roles.includes(data.role)) {
    await logSecurity("admin_denied", { role: data?.role ?? "—" }, { req, userId: uid, alert: true, dedupeKey: uid, dedupeSec: 600 });
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  return uid;
}

export async function logAction(actor: string, action: string, target: string | null, meta: object = {}) {
  await supabaseAdmin.from("admin_log").insert({ actor_id: actor, action, target_id: target, meta });
}
