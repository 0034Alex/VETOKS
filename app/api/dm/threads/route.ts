import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Список чатов: «Чаты» (приняты) и «Запросы» (входящие, ещё не приняты).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const { data: th } = await supabaseAdmin
    .from("dm_threads")
    .select("id, user_a, user_b, initiator, accepted, last_message, last_at")
    .or(`user_a.eq.${uid},user_b.eq.${uid}`)
    .order("last_at", { ascending: false })
    .limit(200);
  const threads = (th ?? []) as any[];

  const { data: bl } = await supabaseAdmin.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
  const hidden = new Set<string>();
  (bl ?? []).forEach((r: any) => hidden.add(r.blocker_id === uid ? r.blocked_id : r.blocker_id));

  const ids = threads.map((t) => t.id);
  const unread: Record<string, number> = {};
  if (ids.length) {
    const { data: um } = await supabaseAdmin
      .from("dm_messages")
      .select("thread_id")
      .in("thread_id", ids)
      .neq("sender_id", uid)
      .is("read_at", null)
      .limit(5000);
    (um ?? []).forEach((m: any) => (unread[m.thread_id] = (unread[m.thread_id] ?? 0) + 1));
  }

  const otherIds = threads.map((t) => (t.user_a === uid ? t.user_b : t.user_a));
  const names: Record<string, string> = {};
  const photos: Record<string, string | null> = {};
  if (otherIds.length) {
    const { data: us } = await supabaseAdmin.from("users").select("id, first_name, photo_url").in("id", otherIds);
    (us ?? []).forEach((u: any) => {
      names[u.id] = u.first_name || "Гость";
      photos[u.id] = u.photo_url ?? null;
    });
    const { data: ps } = await supabaseAdmin.from("participants").select("user_id, photo_url").in("user_id", otherIds);
    (ps ?? []).forEach((p: any) => {
      if (p.photo_url) photos[p.user_id] = p.photo_url;
    });
  }

  const rows = threads
    .map((t) => {
      const other = t.user_a === uid ? t.user_b : t.user_a;
      return {
        userId: other,
        name: names[other] || "Гость",
        photo: photos[other] ?? null,
        last: t.last_message || "",
        lastAt: t.last_at,
        unread: unread[t.id] ?? 0,
        accepted: !!t.accepted,
        mine: t.initiator === uid,
      };
    })
    .filter((r) => !hidden.has(r.userId));

  // Запрос = входящий и не принятый. Свои неотвеченные — в «Чатах» (я ждал ответа).
  const requests = rows.filter((r) => !r.accepted && !r.mine);
  const inbox = rows.filter((r) => r.accepted || r.mine);
  return NextResponse.json({
    ok: true,
    inbox,
    requests,
    unread: inbox.reduce((s, r) => s + r.unread, 0),
    requestCount: requests.length,
  });
}
