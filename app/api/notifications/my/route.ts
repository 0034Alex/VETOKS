import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Уведомления человека: список, счётчик непрочитанных и «прочитать всё» — только через сервер.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "count") {
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_read", false);
    const { count: refs } = await supabaseAdmin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", uid);
    return NextResponse.json({ ok: true, unread: count ?? 0, referrals: refs ?? 0 });
  }

  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id, message, link, is_read, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  // Список отдаём с прежними пометками, а потом отмечаем всё прочитанным.
  await supabaseAdmin.from("notifications").update({ is_read: true }).eq("user_id", uid).eq("is_read", false);
  return NextResponse.json({ ok: true, items: data ?? [] });
}
