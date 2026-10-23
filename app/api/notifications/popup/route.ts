import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Всплывающие сообщения от команды (рассылка из CRM): следующее непрочитанное / «понятно».
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  if (b.action === "seen") {
    await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", String(b.id ?? "")).eq("user_id", uid);
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, message")
    .eq("user_id", uid)
    .eq("is_read", false)
    .eq("popup", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: true, item: null });
  return NextResponse.json({ ok: true, item: data ?? null });
}
