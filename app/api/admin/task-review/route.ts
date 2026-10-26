import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { notify } from "@/lib/shopServer";
import { currencyOfUser } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// CRM → «Задания»: одобрить (начислить награду) или отклонить.
export async function POST(req: Request) {
  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: u } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  if (!u || !["moderator", "super_admin"].includes(u.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.completionId ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.action === "approve") {
    const { data, error } = await supabaseAdmin.rpc("vt_approve_completion", { p_completion: id });
    if (error || !data || !(data as any).ok) {
      return NextResponse.json({ ok: false, error: (data as any)?.error ?? "failed" }, { status: 400 });
    }
    const d = data as any;
    await notify(d.user_id, `✅ Задание «${d.title}» одобрено — начислено ${Math.round(Number(d.reward))} Корон`, "/tasks", "tasks");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reject") {
    await supabaseAdmin
      .from("task_completions")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("status", "pending");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
