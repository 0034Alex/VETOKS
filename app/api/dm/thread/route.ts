import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { blockState, findThread } from "@/lib/dmServer";

export const dynamic = "force-dynamic";

// Переписка с одним человеком. Открытие помечает его сообщения прочитанными.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const other = String(b.withUserId || "");
  if (!other) return bad("bad_request");

  const { data: ou } = await supabaseAdmin.from("users").select("id, first_name, photo_url, privacy").eq("id", other).maybeSingle();
  if (!ou) return bad("no_user", 404);

  const { data: oPart } = await supabaseAdmin.from("participants").select("photo_url").eq("user_id", other).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: mu } = await supabaseAdmin.from("users").select("photo_url").eq("id", uid).maybeSingle();
  const bs = await blockState(uid, other);
  const thread = await findThread(uid, other);
  let messages: any[] = [];
  if (thread && !bs.blockedMe) {
    const { data } = await supabaseAdmin
      .from("dm_messages")
      .select("id, sender_id, body, kind, meta, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(300);
    messages = data ?? [];
    await supabaseAdmin
      .from("dm_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", thread.id)
      .neq("sender_id", uid)
      .is("read_at", null);
  }

  return NextResponse.json({
    ok: true,
    me: uid,
    name: (ou.first_name as string) || "Гость",
    photo: ((oPart as any)?.photo_url ?? (ou as any).photo_url ?? null) as string | null,
    myPhoto: ((mu as any)?.photo_url ?? null) as string | null,
    messages,
    accepted: thread ? !!thread.accepted : true,
    hasThread: !!thread,
    isRequestForMe: !!thread && !thread.accepted && thread.initiator !== uid,
    blockedByMe: bs.blockedByMe,
    blockedMe: bs.blockedMe,
    dmClosed: (ou.privacy as any)?.dm === false,
  });
}
