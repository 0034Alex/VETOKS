import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { posterProfile } from "@/lib/posterServer";
import { parentConsentOk } from "@/lib/parentServer";

export const dynamic = "force-dynamic";

// Страница «Моя афіша»: что подставить в афишу и есть ли уже готовая.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const p = await posterProfile(uid);
  if (!p) return NextResponse.json({ ok: true, participant: false });
  const { data: last } = await supabaseAdmin
    .from("participant_posters")
    .select("image_url, height_cm, created_at, interests, about_text")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    participant: true,
    first: p.first,
    last: p.last,
    age: p.age,
    cat: p.cat,
    city: p.city,
    country: p.country,
    height: (last as any)?.height_cm ?? null,
    interests: (last as any)?.interests ?? "",
    about: (last as any)?.about_text ?? "",
    latest: last ? { url: (last as any).image_url, at: (last as any).created_at } : null,
    canCutout: !!(process.env.PHOTOROOM_API_KEY || process.env.REMOVEBG_API_KEY),
    needParent: !(await parentConsentOk(uid)),
  });
}
