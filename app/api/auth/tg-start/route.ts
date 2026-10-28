import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { newToken } from "@/lib/authServer";
import { botForCountry } from "@/lib/countryBot";

export const dynamic = "force-dynamic";

// Вход из обычного браузера: создаём одноразовую ссылку в бота.
export async function POST(req: Request) {
  const rl = await rateLimit(req, "auth/tg-start", 20, 600);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const bot = await botForCountry(String(b?.countryId ?? "").slice(0, 64));
  if (!bot.username) return NextResponse.json({ status: "no_bot" });
  const token = newToken();
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("tg_login_tokens")
    .insert({ token, status: "pending", expires_at: expires });
  if (error) return NextResponse.json({ status: "error" }, { status: 500 });

  // Заодно чистим старые записи.
  await supabaseAdmin
    .from("tg_login_tokens")
    .delete()
    .lt("expires_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  return NextResponse.json({
    status: "ok",
    token,
    link: `https://t.me/${bot.username}?start=login_${token}`,
  });
}
