import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAKE_NAMES = [
  "Анна", "Виктория", "Дарья", "Екатерина", "Злата",
  "Ирина", "Ксения", "Лилия", "Мария", "Наталья",
  "Олеся", "Полина", "Регина", "Софья", "Татьяна",
  "Ульяна", "Виолетта", "Юлия", "Яна", "Алина",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!process.env.SEED_SECRET || key !== process.env.SEED_SECRET) {
    return NextResponse.json({ ok: false, error: "Неверный ключ доступа." }, { status: 401 });
  }

  const { data: season } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return NextResponse.json(
      { ok: false, error: "Сначала создайте сезон в CRM → Этапы сезона." },
      { status: 400 }
    );
  }

  const { data: regionsData } = await supabaseAdmin.from("regions").select("id");
  const regions = regionsData ?? [];
  if (regions.length === 0) {
    return NextResponse.json(
      { ok: false, error: "В базе нет ни одного региона." },
      { status: 400 }
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < FAKE_NAMES.length; i++) {
    const name = FAKE_NAMES[i];
    const fakeEmail = `seed-vetoks+miss${i + 1}@vetoks.local`;

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", fakeEmail)
      .maybeSingle();

    if (existing) {
      skipped.push(name);
      continue;
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: "Vetoks2026!",
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      skipped.push(`${name} (ошибка аккаунта)`);
      continue;
    }

    const region = regions[i % regions.length];

    await supabaseAdmin.from("users").insert({
      id: authUser.user.id,
      first_name: name,
      phone: `+7900000${String(i + 1).padStart(4, "0")}`,
      email: fakeEmail,
      region_id: region.id,
      role: "viewer",
    });

    await supabaseAdmin.from("participants").insert({
      user_id: authUser.user.id,
      season_id: season.id,
      region_id: region.id,
      display_name: name,
      bio: "Тестовая анкета",
      photo_url: `https://picsum.photos/seed/vetoks-miss-${i + 1}/500/650`,
      is_eliminated: false,
    });

    created.push(name);
  }

  return NextResponse.json({ ok: true, created, skipped });
}
