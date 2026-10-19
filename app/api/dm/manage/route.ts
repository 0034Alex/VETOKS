import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const CONTACT_RE = /(https?:\/\/|www\.|t\.me\/|[a-z0-9-]+\.(com|ua|ru|me|net|org|io|app)\b|@[a-z0-9_]{4,}|\+?\d[\d\s().-]{8,}\d)/i;
const DELETED = "🚫 Сообщение удалено";

// Своё личное сообщение: изменить или удалить. Удалённое остаётся в базе для разбора жалоб, но людям не показывается.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "dm/manage", 30, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return bad("empty");

  const { data: m } = await supabaseAdmin.from("dm_messages").select("id, thread_id, sender_id, kind").eq("id", id).maybeSingle();
  if (!m || (m as any).sender_id !== uid) return bad("forbidden", 403);
  if ((m as any).kind && (m as any).kind !== "text") return bad("forbidden", 403);
  const threadId = (m as any).thread_id as string;

  let newBody: string;
  if (b.action === "delete") {
    newBody = DELETED;
    const { error } = await supabaseAdmin.from("dm_messages").update({ body: newBody, meta: { deleted: true } }).eq("id", id);
    if (error) return bad("failed", 500);
  } else if (b.action === "edit") {
    const text = String(b.text ?? "").trim().slice(0, 2000);
    if (!text) return bad("empty");
    // Пока запрос не принят, ссылки и контакты писать нельзя (как при отправке).
    const { data: th } = await supabaseAdmin.from("dm_threads").select("accepted").eq("id", threadId).maybeSingle();
    if (!(th as any)?.accepted && CONTACT_RE.test(text)) return bad("no_contacts_in_request");
    newBody = text;
    const { error } = await supabaseAdmin.from("dm_messages").update({ body: newBody, meta: { edited: true } }).eq("id", id);
    if (error) return bad("failed", 500);
  } else {
    return bad("bad_action");
  }

  // Если это последнее сообщение, в списке чатов показываем новый текст.
  const { data: last } = await supabaseAdmin
    .from("dm_messages")
    .select("id")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if ((last as any)?.id === id) {
    await supabaseAdmin.from("dm_threads").update({ last_message: newBody.slice(0, 120) }).eq("id", threadId);
  }
  return NextResponse.json({ ok: true });
}
