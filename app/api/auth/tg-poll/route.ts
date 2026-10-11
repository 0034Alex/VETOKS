import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findUserByTelegramId, tokenHashForUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Браузер спрашивает: подтвердил ли человек вход в боте?
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ status: "error" }, { status: 400 });

  const { data: row } = await supabaseAdmin
    .from("tg_login_tokens")
    .select("token, status, telegram_id, tg_first_name, expires_at, used")
    .eq("token", String(token))
    .maybeSingle();

  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ status: "expired" });
  }
  if (row.status !== "confirmed" || !row.telegram_id) {
    return NextResponse.json({ status: "pending" });
  }

  const user = await findUserByTelegramId(row.telegram_id);
  if (!user) {
    // Аккаунта ещё нет — браузер перейдёт к регистрации с этим же ключом.
    return NextResponse.json({ status: "new", first_name: row.tg_first_name ?? "" });
  }

  const tokenHash = await tokenHashForUser(user.id);
  if (!tokenHash) return NextResponse.json({ status: "error" }, { status: 500 });

  await supabaseAdmin.from("tg_login_tokens").update({ used: true }).eq("token", row.token);
  return NextResponse.json({ status: "ok", token_hash: tokenHash });
}
