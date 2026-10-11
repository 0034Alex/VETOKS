import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BOT_USERNAME, newToken } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Вход из обычного браузера: создаём одноразовую ссылку в бота.
export async function POST() {
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
    link: `https://t.me/${BOT_USERNAME}?start=login_${token}`,
  });
}
