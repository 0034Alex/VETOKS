import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Кому предназначена ссылка-приглашение (публично, по одноразовому ключу).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "");
  if (!token) return NextResponse.json({ ok: false, error: "bad_link" }, { status: 400 });
  const { data } = await supabaseAdmin
    .from("staff_invites")
    .select("email, name, expires_at, used_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked || data.used_at || new Date(data.expires_at as string).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "bad_link" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, email: data.email, name: data.name });
}
