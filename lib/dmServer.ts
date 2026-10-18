import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Пара пользователей всегда хранится в одном порядке — тогда чат между двумя людьми один.
export function pairOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findThread(a: string, b: string) {
  const [x, y] = pairOrder(a, b);
  const { data } = await supabaseAdmin
    .from("dm_threads")
    .select("id, user_a, user_b, initiator, accepted, last_message, last_at")
    .eq("user_a", x)
    .eq("user_b", y)
    .maybeSingle();
  return data as
    | { id: string; user_a: string; user_b: string; initiator: string; accepted: boolean; last_message: string | null; last_at: string }
    | null;
}

// Есть ли блокировка в любую сторону. blockedByMe — это я заблокировал собеседника.
export async function blockState(me: string, other: string) {
  const { data } = await supabaseAdmin
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`and(blocker_id.eq.${me},blocked_id.eq.${other}),and(blocker_id.eq.${other},blocked_id.eq.${me})`);
  const rows = (data ?? []) as { blocker_id: string; blocked_id: string }[];
  return {
    blockedByMe: rows.some((r) => r.blocker_id === me),
    blockedMe: rows.some((r) => r.blocker_id === other),
  };
}

// Сообщения идут сразу в «Чаты», если получатель подписан на участницу-отправителя или люди подписаны друг на друга.
export async function recipientFollowsSender(recipient: string, sender: string): Promise<boolean> {
  const { data: p } = await supabaseAdmin.from("participants").select("id").eq("user_id", sender);
  const ids = (p ?? []).map((r: any) => r.id);
  // Взаимная подписка двух людей — тоже сразу в «Чаты».
  const { data: mu } = await supabaseAdmin
    .from("user_follows")
    .select("follower_id, followed_id")
    .or(`and(follower_id.eq.${recipient},followed_id.eq.${sender}),and(follower_id.eq.${sender},followed_id.eq.${recipient})`);
  if ((mu ?? []).length >= 2) return true;
  if (ids.length === 0) return false;
  const { data: f } = await supabaseAdmin
    .from("participant_follows")
    .select("id")
    .eq("user_id", recipient)
    .in("participant_id", ids)
    .limit(1);
  return (f ?? []).length > 0;
}
