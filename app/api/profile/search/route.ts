import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { cleanNick } from "@/lib/nick";

export const dynamic = "force-dynamic";

// Поиск людей по нику (начало ника).
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const q = cleanNick(body.q);
  if (q.length < 2 || q.length > 20 || !/^[a-z0-9_]+$/.test(q)) return NextResponse.json({ ok: true, items: [] });
  const pattern = q.replace(/_/g, "\\_") + "%";
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, first_name, nick, photo_url")
    .ilike("nick", pattern)
    .eq("is_banned", false)
    .not("nick", "is", null)
    .limit(8);
  const ids = (users ?? []).map((u: any) => u.id);
  const { data: parts } = ids.length
    ? await supabaseAdmin.from("participants").select("id, user_id, photo_url").in("user_id", ids)
    : { data: [] as any[] };
  const byUser: Record<string, any> = {};
  (parts ?? []).forEach((p: any) => (byUser[p.user_id] = p));
  const items = (users ?? []).map((u: any) => ({
    nick: u.nick,
    name: u.first_name ?? "Гость",
    photoUrl: byUser[u.id]?.photo_url ?? u.photo_url ?? null,
    isParticipant: !!byUser[u.id],
  }));
  return NextResponse.json({ ok: true, items });
}
