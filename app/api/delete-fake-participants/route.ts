import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!process.env.SEED_SECRET || key !== process.env.SEED_SECRET) {
    return NextResponse.json({ ok: false, error: "Неверный ключ доступа." }, { status: 401 });
  }

  const { data: fakeUsers } = await supabaseAdmin
    .from("users")
    .select("id, first_name, email")
    .like("email", "seed-vetoks+%");

  const removed: string[] = [];
  const errors: string[] = [];

  for (const u of fakeUsers ?? []) {
    await supabaseAdmin.from("participants").delete().eq("user_id", u.id);
    await supabaseAdmin.from("users").delete().eq("id", u.id);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (authError) {
      errors.push(`${u.first_name ?? u.email}: ${authError.message}`);
    } else {
      removed.push(u.first_name ?? u.email ?? u.id);
    }
  }

  return NextResponse.json({ ok: true, removed, errors });
}
