import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Создание анкеты пользователя сразу после регистрации. Роль всегда «обычный пользователь»,
// почта берётся из аккаунта, а не из запроса.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "regprof", 10, 600);
  if (limited) return limited;

  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const firstName = String(b.first_name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const regionId = String(b.region_id ?? "");
  if (!firstName || !regionId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const { data: reg } = await supabaseAdmin.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (!reg) return NextResponse.json({ ok: false, error: "no_region" }, { status: 400 });

  const { data: exists } = await supabaseAdmin.from("users").select("id").eq("id", uid).maybeSingle();
  if (exists) return NextResponse.json({ ok: true, existed: true });

  const { data: au } = await supabaseAdmin.auth.admin.getUserById(uid);
  const email = au?.user?.email ?? null;

  const { error } = await supabaseAdmin.from("users").insert({
    id: uid,
    first_name: firstName,
    email,
    region_id: regionId,
    role: "viewer",
  });
  if (error) return NextResponse.json({ ok: false, error: "save", message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
