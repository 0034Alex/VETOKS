import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { rateHit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Личные данные владельца аккаунта: телефон, почта, роль и т.д.
// Из браузера напрямую их читать нельзя — отдаёт только сервер и только самому человеку.
export async function POST(req: Request) {
  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const r = await rateHit(`me:${uid}`, 60, 300);
  if (!r.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const { data } = await supabaseAdmin
    .from("users")
    .select(
      "id, first_name, phone, phone_verified, email, region_id, referral_code, role, is_banned, permissions, staff_countries, region_pending, telegram_id, region_changed_at, photo_url, bio, last_login_at, regions(name)"
    )
    .eq("id", uid)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false, error: "no_user" }, { status: 404 });

  // Отметка последнего захода — не чаще раза в 10 минут.
  const last = (data as any).last_login_at ? new Date((data as any).last_login_at).getTime() : 0;
  if (Date.now() - last > 10 * 60 * 1000) {
    await supabaseAdmin.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", uid);
  }

  const { last_login_at: _l, ...user } = data as any;
  return NextResponse.json({ ok: true, user });
}
