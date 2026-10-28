import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyInitDataAny } from "@/lib/telegramAuth";
import { botForUser } from "@/lib/countryBot";
import { newToken, userIdFromBearer } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Начало подтверждения номера: выдаём ссылку в бота.
export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });
  const rl = await rateLimit(req, "verify/start", 6, 600, userId);
  if (rl) return rl;

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("phone_verified")
    .eq("id", userId)
    .maybeSingle();
  if (me?.phone_verified) return NextResponse.json({ status: "verified" });

  const body = await req.json().catch(() => ({}));
  const tg = body.initData ? await verifyInitDataAny(String(body.initData)) : null;

  const token = newToken();
  const { error } = await supabaseAdmin.from("phone_verify_tokens").insert({
    token,
    user_id: userId,
    telegram_id: tg ? String(tg.id) : null,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ status: "error" }, { status: 500 });

  const vbot = await botForUser(userId);
  if (!vbot.username) return NextResponse.json({ status: "no_bot" }, { status: 409 });
  return NextResponse.json({
    status: "ok",
    token,
    link: `https://t.me/${vbot.username}?start=verify_${token}`,
  });
}
