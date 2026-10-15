import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser, bad } from "@/lib/shopServer";
import { cleanNick } from "@/lib/nick";

export const dynamic = "force-dynamic";

// По нику находим человека: участница или обычный пользователь.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const n = cleanNick(body.nick);
  if (!n || n.length > 30) return bad("not_found", 404);
  const { data: u } = await supabaseAdmin.from("users").select("id, is_banned").eq("nick", n).maybeSingle();
  if (!u || u.is_banned) return bad("not_found", 404);
  const { data: p } = await supabaseAdmin.from("participants").select("id").eq("user_id", u.id).maybeSingle();
  return NextResponse.json({ ok: true, userId: u.id, participantId: p?.id ?? null });
}
