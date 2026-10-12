import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

const STAGES = ["lead", "talks", "agreed", "paid", "active", "done", "lost"];

async function recount(sponsorId: string) {
  const { data } = await supabaseAdmin.from("sponsor_payments").select("amount").eq("sponsor_id", sponsorId);
  const total = (data ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  await supabaseAdmin.from("sponsors").update({ amount: total }).eq("id", sponsorId);
}

export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const a = body.action;

  if (a === "list") {
    const { data: rows } = await supabaseAdmin
      .from("sponsors")
      .select("id, name, amount, status, package_type, user_id, contact_info, stage, notes, follow_up_at, created_at")
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: pays } = ids.length
      ? await supabaseAdmin
          .from("sponsor_payments")
          .select("id, sponsor_id, amount, paid_at, note")
          .in("sponsor_id", ids)
          .order("paid_at", { ascending: false })
      : { data: [] as any[] };
    return NextResponse.json({ ok: true, rows: rows ?? [], payments: pays ?? [] });
  }

  if (a === "create") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false }, { status: 400 });
    await supabaseAdmin.from("sponsors").insert({
      name,
      package_type: String(body.packageType ?? "").trim() || null,
      status: "active",
      stage: "lead",
    });
    await logAction(uid, "partner_create", null, { name });
    return NextResponse.json({ ok: true });
  }

  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (a === "update") {
    const patch: Record<string, any> = {};
    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) return NextResponse.json({ ok: false }, { status: 400 });
      patch.stage = body.stage;
    }
    if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 3000);
    if (body.followUpAt !== undefined) patch.follow_up_at = body.followUpAt || null;
    await supabaseAdmin.from("sponsors").update(patch).eq("id", id);
    if (patch.stage) await logAction(uid, "partner_stage", null, { sponsor: id, stage: patch.stage });
    return NextResponse.json({ ok: true });
  }

  if (a === "add_payment") {
    const amount = Number(body.amount);
    if (!isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "amount" }, { status: 400 });
    await supabaseAdmin.from("sponsor_payments").insert({
      sponsor_id: id,
      amount,
      paid_at: body.paidAt || new Date().toISOString().slice(0, 10),
      note: String(body.note ?? "").slice(0, 300) || null,
    });
    await recount(id);
    await logAction(uid, "partner_payment", null, { sponsor: id, amount });
    return NextResponse.json({ ok: true });
  }

  if (a === "delete_payment") {
    await supabaseAdmin.from("sponsor_payments").delete().eq("id", String(body.paymentId ?? ""));
    await recount(id);
    return NextResponse.json({ ok: true });
  }

  if (a === "find_user") {
    const qv = String(body.query ?? "").trim();
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, first_name")
      .eq(qv.includes("@") ? "email" : "phone", qv)
      .maybeSingle();
    return NextResponse.json({ ok: true, user: data ?? null });
  }

  if (a === "link") {
    await supabaseAdmin.from("sponsors").update({ user_id: String(body.userId), status: "approved" }).eq("id", id);
    await logAction(uid, "partner_link", String(body.userId), { sponsor: id });
    return NextResponse.json({ ok: true });
  }

  if (a === "unlink") {
    await supabaseAdmin.from("sponsors").update({ user_id: null, status: "active" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
