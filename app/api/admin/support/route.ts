import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { notify } from "@/lib/shopServer";
import { regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "in_progress", "done"];

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));

  if (body.action === "list") {
    const { data } = await supabaseAdmin
      .from("support_requests")
      .select("id, name, phone, email, message, status, created_at, user_id, reply, replied_at")
      .order("created_at", { ascending: false })
      .limit(200);
    let rows: any[] = data ?? [];
    // Заявки только пользователей выбранной страны (без привязанного пользователя — остаются).
    if (body.countryId) {
      const rids = await regionIdsOfCountry(String(body.countryId));
      const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const ok = new Set<string>();
      if (uids.length && rids.length) {
        const { data: us } = await supabaseAdmin.from("users").select("id").in("id", uids).in("region_id", rids);
        (us ?? []).forEach((u: any) => ok.add(u.id));
      }
      rows = rows.filter((r) => !r.user_id || ok.has(r.user_id));
    }
    return NextResponse.json({ ok: true, rows });
  }

  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.action === "status" && STATUSES.includes(body.status)) {
    await supabaseAdmin.from("support_requests").update({ status: body.status }).eq("id", id);
    await logAction(uid, "support_" + body.status, null, { request: id });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reply") {
    const text = String(body.text ?? "").trim().slice(0, 2000);
    if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    const { data: r } = await supabaseAdmin.from("support_requests").select("user_id").eq("id", id).maybeSingle();
    await supabaseAdmin
      .from("support_requests")
      .update({ reply: text, replied_at: new Date().toISOString(), status: "done" })
      .eq("id", id);
    if (r?.user_id) await notify(r.user_id, "💬 Поддержка ответила на ваше обращение", "/support", "support");
    await logAction(uid, "support_reply", r?.user_id ?? null, { request: id });
    return NextResponse.json({ ok: true, delivered: !!r?.user_id });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
