import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Страна посетителя по адресу (Vercel подсказывает её в заголовке). Нужна только как подсказка
// при регистрации: человек всегда может выбрать другую страну.
export async function GET(req: Request) {
  const code = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "").toUpperCase().slice(0, 2);
  return NextResponse.json({ ok: true, code: /^[A-Z]{2}$/.test(code) ? code : null });
}
