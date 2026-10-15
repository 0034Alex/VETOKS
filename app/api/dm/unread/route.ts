import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Число непрочитанных (для значка ✉️ в профиле), запросы считаем отдельно.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const { data: th } = await supabaseAdmin
    .from("dm_threads")
    .select("id")
    .or(`user_a.eq.${uid},user_b.eq.${uid}`)
    .limit(500);
  const ids = (th ?? []).map((t: any) => t.id);
  if (!ids.length) return NextResponse.json({ ok: true, count: 0 });
  const { count } = await supabaseAdmin
    .from("dm_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", ids)
    .neq("sender_id", uid)
    .is("read_at", null);
  return NextResponse.json({ ok: true, count: count ?? 0 });
}
