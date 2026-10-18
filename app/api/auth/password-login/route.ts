import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { phoneVariants } from "@/lib/phone";
import { logSecurity, recordActivity } from "@/lib/security";
import { clientIp, lockCheck, lockClear, lockFail, lockedResponse, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Вход по почте или по ПОДТВЕРЖДЁННОМУ номеру + пароль.
// Почту аккаунта наружу не отдаём — вход делает сервер.
export async function POST(req: NextRequest) {
  const { identifier, password } = await req.json().catch(() => ({}));
  const id = String(identifier || "").trim();
  const pass = String(password || "");
  const fail = NextResponse.json(
    { status: "error", message: "Неверные данные для входа или пароль." },
    { status: 401 }
  );
  if (!id || !pass || id.length > 120 || pass.length > 200) return fail;

  // Лимит запросов и блокировка: 3 неверных пароля → 15 мин → 1 час → сутки.
  const limited = await rateLimit(req, "login", 40, 600);
  if (limited) return limited;
  const ip = clientIp(req);
  const ident = id.toLowerCase();
  const kPair = `login:${ident}:${ip}`;
  const kIdent = `login:id:${ident}`;
  const kIp = `login:ip:${ip}`;
  for (const k of [kPair, kIdent, kIp]) {
    const c = await lockCheck(k);
    if (c.locked) return lockedResponse(c.retry);
  }
  async function bad() {
    const a = await lockFail(kPair, 3);
    const b = await lockFail(kIdent, 12);
    const c = await lockFail(kIp, 40);
    const hit = [a, b, c].find((x) => x.locked);
    if (hit) await logSecurity("login_locked", { login: ident.slice(0, 80) }, { req });
    return hit ? lockedResponse(hit.retry) : fail;
  }

  let email: string | null = null;
  if (id.includes("@")) {
    email = id.toLowerCase();
  } else {
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("id")
      .in("phone", phoneVariants(id))
      .eq("phone_verified", true)
      .limit(1)
      .maybeSingle();
    if (u) {
      const { data: au } = await supabaseAdmin.auth.admin.getUserById(u.id);
      email = au?.user?.email ?? null;
    }
  }
  if (!email) return bad();

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) return bad();
  await Promise.all([lockClear(kPair), lockClear(kIdent)]);
  if (data.user?.id) await recordActivity(req, data.user.id, "login");

  return NextResponse.json({
    status: "ok",
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
