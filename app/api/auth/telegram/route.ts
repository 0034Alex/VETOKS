import { NextRequest, NextResponse } from "next/server";
import { verifyInitData } from "@/lib/telegramAuth";
import { findUserByTelegramId, tokenHashForUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Вход из Telegram-мини-приложения: подпись Telegram -> наш пользователь.
export async function POST(req: NextRequest) {
  const { initData } = await req.json().catch(() => ({}));
  const tg = verifyInitData(String(initData || ""));
  if (!tg) return NextResponse.json({ status: "error" }, { status: 401 });

  const user = await findUserByTelegramId(tg.id);
  if (!user) {
    return NextResponse.json({ status: "new", first_name: tg.first_name ?? "" });
  }
  const tokenHash = await tokenHashForUser(user.id);
  if (!tokenHash) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok", token_hash: tokenHash });
}
