import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { countryOfUser } from "@/lib/countryServer";
import { filterVisible } from "@/lib/postVisibility";
import { placeKey } from "@/lib/places";

export const dynamic = "force-dynamic";

// Места: поиск при выборе и список публикаций из места.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "search");
  const country = await countryOfUser(me);

  if (action === "search") {
    const key = placeKey(String(b.q ?? "")).replace(/[%_,()]/g, " ").trim();
    let q = supabaseAdmin.from("places").select("id, name").order("created_at", { ascending: false }).limit(8);
    q = country ? q.eq("country_id", country) : q;
    if (key) q = q.ilike("name_key", `%${key}%`);
    const { data: pl } = await q;
    const ids = (pl ?? []).map((p: any) => p.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: ps } = await supabaseAdmin.from("content_posts").select("place_id").in("place_id", ids).eq("visibility", "all").limit(5000);
      (ps ?? []).forEach((r: any) => (counts[r.place_id] = (counts[r.place_id] ?? 0) + 1));
    }
    return NextResponse.json({ ok: true, items: (pl ?? []).map((p: any) => ({ id: p.id, name: p.name, count: counts[p.id] ?? 0 })) });
  }

  if (action === "get") {
    const id = String(b.placeId || "");
    const { data: place } = await supabaseAdmin.from("places").select("id, name, country_id").eq("id", id).maybeSingle();
    if (!place) return bad("not_found", 404);
    if (country && place.country_id && place.country_id !== country) return bad("not_found", 404);
    const { data: posts } = await supabaseAdmin
      .from("content_posts")
      .select("id, user_id, participant_id, video_url, photo_url, visibility, participants(user_id)")
      .eq("place_id", id)
      .order("submitted_at", { ascending: false })
      .limit(200);
    const ownerOf = (p: any) => {
      const pp = Array.isArray(p.participants) ? p.participants[0] : p.participants;
      return (p.user_id ?? pp?.user_id) as string | undefined;
    };
    const vis = await filterVisible(me, posts ?? [], ownerOf, (p: any) => p.visibility);
    return NextResponse.json({
      ok: true,
      place: { id: place.id, name: place.name },
      items: vis
        .filter((p: any) => p.video_url || p.photo_url)
        .map((p: any) => ({ postId: p.id, kind: p.video_url ? "video" : "photo", url: p.video_url || p.photo_url })),
    });
  }
  return bad("bad_request");
}
