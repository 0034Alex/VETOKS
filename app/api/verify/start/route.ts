import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyInitData } from "@/lib/telegramAuth";
import { BOT_USERNAME, newToken, userIdFromBearer } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Начало подтверждения номера: выдаём ссылку в бота.
export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("phone_verified")
    .eq("id", userId)
    .maybeSingle();
  if (me?.phone_verified) return NextResponse.json({ status: "verified" });

  const body = await req.json().catch(() => ({}));
  const tg = body.initData ? verifyInitData(String(body.initData)) : null;

  const token = newToken();
  const { error } = await supabaseAdmin.from("phone_verify_tokens").insert({
    token,
    user_id: userId,
    telegram_id: tg ? String(tg.id) : null,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ status: "error" }, { status: 500 });

  return NextResponse.json({
    status: "ok",
    token,
    link: `https://t.me/${BOT_USERNAME}?start=verify_${token}`,
  });
}
