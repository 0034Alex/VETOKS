import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sameCountry } from "@/lib/countryServer";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { blockState, findThread, pairOrder, recipientFollowsSender } from "@/lib/dmServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const REQUEST_LIMIT = 3; // сколько сообщений можно отправить, пока запрос не принят
const DAILY_NEW_REQUESTS = 15; // сколько новых людей можно «потревожить» за сутки
const DECLINE_DAYS = 30; // сколько дней нельзя писать тому, кто отклонил запрос
// Ссылки, телефоны и @ники — только после того, как запрос принят.
const CONTACT_RE = /(https?:\/\/|www\.|t\.me\/|[a-z0-9-]+\.(com|ua|ru|me|net|org|io|app)\b|@[a-z0-9_]{4,}|\+?\d[\d\s().-]{8,}\d)/i;

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "dm/send", 30, 60, uid);
  if (rl) return rl;

  const b = await req.json().catch(() => ({}));
  const to = String(b.toUserId || "");
  const postId = b.postId ? String(b.postId) : "";
  const isPost = !!postId;
  const text = isPost ? "📷 Публикация" : String(b.body || "").trim().slice(0, 2000);
  if (!to || to === uid || !text) return bad("bad_request");

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, first_name, privacy, is_banned")
    .eq("id", to)
    .maybeSingle();
  if (!target || target.is_banned) return bad("no_user", 404);
  if (!(await sameCountry(uid, to))) return bad("no_user", 404);
  // Подростки общаются только с подростками.
  {
    const { data: both } = await supabaseAdmin.from("users").select("id, age_category, is_official").in("id", [uid, to]);
    const t = (id: string) => ((both ?? []) as any[]).find((x) => x.id === id)?.age_category === "teen";
    const off = ((both ?? []) as any[]).some((x) => x.is_official);
    if (!off && t(uid) !== t(to)) return bad("no_user", 404);
  }
  if ((target.privacy as any)?.dm === false) return bad("dm_closed", 403);

  const bs = await blockState(uid, to);
  if (bs.blockedByMe) return bad("you_blocked", 403);
  if (bs.blockedMe) return bad("cant_send", 403);

  // Отклонил запрос — какое-то время писать ему нельзя (человеку это не показываем как отказ).
  const since30 = new Date(Date.now() - DECLINE_DAYS * 86400_000).toISOString();
  const { data: dec } = await supabaseAdmin
    .from("dm_declines")
    .select("sender_id")
    .eq("recipient_id", to)
    .eq("sender_id", uid)
    .gte("created_at", since30)
    .limit(1);
  if ((dec ?? []).length > 0) return bad("cant_send", 403);

  let thread = await findThread(uid, to);
  let firstOfRequest = false;

  if (!thread) {
    const auto = await recipientFollowsSender(to, uid);
    if (!auto) {
      // Не больше N новых людей в сутки, чтобы не рассылать запросы тысячам.
      const sinceDay = new Date(Date.now() - 86400_000).toISOString();
      const { count: openReq } = await supabaseAdmin
        .from("dm_threads")
        .select("id", { count: "exact", head: true })
        .eq("initiator", uid)
        .eq("accepted", false)
        .gte("last_at", sinceDay);
      if ((openReq ?? 0) >= DAILY_NEW_REQUESTS) return bad("too_many_requests", 429);
      if (!isPost && CONTACT_RE.test(text)) return bad("no_contacts_in_request", 400);
    }
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
      if (!isPost && CONTACT_RE.test(text)) return bad("no_contacts_in_request", 400);
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
    .insert(isPost ? { thread_id: thread!.id, sender_id: uid, body: text, kind: "post", meta: { postId } } : { thread_id: thread!.id, sender_id: uid, body: text, kind: "text" });
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
