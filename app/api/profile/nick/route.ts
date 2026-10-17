import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser, bad } from "@/lib/shopServer";
import { cleanNick, nickProblem, NICK_COOLDOWN_DAYS } from "@/lib/nick";

export const dynamic = "force-dynamic";

// get — мой ник; check — свободен ли; set — сохранить.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "get");

  const { data: me } = await supabaseAdmin.from("users").select("nick, nick_changed_at, verified_badge, role").eq("id", uid).maybeSingle();
  const current = (me?.nick as string | null) ?? null;
  let canChangeAt: string | null = null;
  if (current && me?.nick_changed_at) {
    const t = new Date(me.nick_changed_at as string).getTime() + NICK_COOLDOWN_DAYS * 86400000;
    if (t > Date.now()) canChangeAt = new Date(t).toISOString();
  }

  if (action === "get") return NextResponse.json({ ok: true, nick: current, canChangeAt });

  const n = cleanNick(body.nick);
  // Аккаунтам с галочкой от команды (и владельцу) служебные слова в нике разрешены.
  const trusted = !!(me as any)?.verified_badge || (me as any)?.role === "super_admin";
  const problem = nickProblem(n);
  if (problem && !(problem === "reserved" && trusted)) return NextResponse.json({ ok: false, error: problem });

  if (n === (current ?? "").toLowerCase()) return NextResponse.json({ ok: true, available: true, same: true, nick: current });

  const { data: taken } = await supabaseAdmin.from("users").select("id").eq("nick", n).neq("id", uid).limit(1);
  if (taken && taken.length > 0) return NextResponse.json({ ok: false, error: "taken" });

  if (action === "check") return NextResponse.json({ ok: true, available: true });

  if (action === "set") {
    if (canChangeAt) return NextResponse.json({ ok: false, error: "cooldown", canChangeAt });
    const { error } = await supabaseAdmin
      .from("users")
      .update({ nick: n, nick_changed_at: new Date().toISOString() })
      .eq("id", uid);
    if (error) {
      if ((error as any).code === "23505") return NextResponse.json({ ok: false, error: "taken" });
      return bad("db", 500);
    }
    return NextResponse.json({ ok: true, nick: n });
  }
  return bad("action");
}
