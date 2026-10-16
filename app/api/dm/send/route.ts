import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sameCountry } from "@/lib/countryServer";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { blockState, findThread, pairOrder, recipientFollowsSender } from "@/lib/dmServer";

export const dynamic = "force-dynamic";

const REQUEST_LIMIT = 3; // сколько сообщений можно отправить, пока запрос не принят

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;

  const b = await req.json().catch(() => ({}));
  const to = String(b.toUserId || "");
  const text = String(b.body || "").trim().slice(0, 2000);
  if (!to || to === uid || !text) return bad("bad_request");

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, first_name, privacy, is_banned")
    .eq("id", to)
    .maybeSingle();
  if (!target || target.is_banned) return bad("no_user", 404);
  if (!(await sameCountry(uid, to))) return bad("no_user", 404);
  if ((target.privacy as any)?.dm === false) return bad("dm_closed", 403);

  const bs = await blockState(uid, to);
  if (bs.blockedByMe) return bad("you_blocked", 403);
  if (bs.blockedMe) return bad("cant_send", 403);

  let thread = await findThread(uid, to);
  let firstOfRequest = false;

  if (!thread) {
    const auto = await recipientFollowsSender(to, uid);
    const [x, y] = pairOrder(uid, to);
    const { data: created, error } = await supabaseAdmin
      .from("dm_threads")
      .insert({ user_a: x, user_b: y, initiator: uid, accepted: auto })
      .select("id, user_a, user_b, initiator, accepted, last_message, last_at")
      .single();
    if (error || !created) return bad("server", 500, { detail: error?.message });
    thread = created as any;
    firstOfRequest = !auto;
  } else if (!thread.accepted) {
    if (thread.initiator !== uid) {
      // Получатель ответил — запрос принят.
      await supabaseAdmin.from("dm_threads").update({ accepted: true }).eq("id", thread.id);
      thread.accepted = true;
    } else if (await recipientFollowsSender(to, uid)) {
      await supabaseAdmin.from("dm_threads").update({ accepted: true }).eq("id", thread.id);
      thread.accepted = true;
    } else {
      const { count } = await supabaseAdmin
        .from("dm_messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread.id)
        .eq("sender_id", uid);
      if ((count ?? 0) >= REQUEST_LIMIT) return bad("request_limit", 429);
    }
  }

  // Были ли у получателя непрочитанные от меня (чтобы не слать уведомление на каждое сообщение).
  const { count: unreadBefore } = await supabaseAdmin
    .from("dm_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread!.id)
    .eq("sender_id", uid)
    .is("read_at", null);

  const { error: mErr } = await supabaseAdmin
    .from("dm_messages")
    .insert({ thread_id: thread!.id, sender_id: uid, body: text, kind: "text" });
  if (mErr) return bad("server", 500, { detail: mErr.message });

  await supabaseAdmin
    .from("dm_threads")
    .update({ last_message: text.slice(0, 120), last_at: new Date().toISOString() })
    .eq("id", thread!.id);

  if ((unreadBefore ?? 0) === 0) {
    const { data: me } = await supabaseAdmin.from("users").select("first_name").eq("id", uid).maybeSingle();
    const name = (me?.first_name as string) || "Гость";
    await notify(
      to,
      firstOfRequest ? `✉️ Новый запрос на переписку от ${name}` : `✉️ Новое сообщение от ${name}`,
      "/chats",
      "other"
    );
  }

  return NextResponse.json({ ok: true, accepted: thread!.accepted });
}
