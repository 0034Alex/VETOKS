import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser, bad } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Публичная страница обычного человека (не участницы): только то, что он сам разрешил показывать.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const id = String(body.userId ?? "");
  if (!id) return bad("no_user");

  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id, first_name, phone_verified, photo_url, bio, social_links, privacy, referral_code, is_banned, region_id, regions(name)")
    .eq("id", id)
    .maybeSingle();
  if (!u || u.is_banned) return bad("not_found", 404);

  const { data: part } = await supabaseAdmin.from("participants").select("id").eq("user_id", id).maybeSingle();
  if (part) return NextResponse.json({ ok: true, participantId: part.id });

  const priv = ((u.privacy ?? {}) as Record<string, boolean>) || {};
  let following: number | null = null;
  if (priv.follows !== false) {
    const { count } = await supabaseAdmin
      .from("participant_follows")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id);
    following = count ?? 0;
  }
  const links = Array.isArray(u.social_links) ? (u.social_links as unknown[]).filter((x) => typeof x === "string") : [];
  return NextResponse.json({
    ok: true,
    isSelf: me === id,
    verified: !!u.phone_verified,
    name: u.first_name ?? "Гость",
    photoUrl: u.photo_url ?? null,
    bio: u.bio ?? "",
    city: priv.region === false ? null : (u as any).regions?.name ?? null,
    handle: u.referral_code ? "@" + String(u.referral_code).toLowerCase() : null,
    socials: links,
    following,
    canWrite: priv.dm !== false,
  });
}
