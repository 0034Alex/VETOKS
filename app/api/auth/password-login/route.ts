import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { phoneVariants } from "@/lib/phone";

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
  if (!id || !pass) return fail;

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
  if (!email) return fail;

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) return fail;

  return NextResponse.json({
    status: "ok",
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
