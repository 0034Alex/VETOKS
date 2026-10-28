import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { countryOfUser } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Зал славы: шоу (идущие и законченные) и победительницы каждого шоу.
// Человек видит только победителей своей страны.
export async function POST(req: Request) {
  const uid = await userIdFromBearer(req);
  const cid = uid ? await countryOfUser(uid) : null;
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);
  const { data: shows } = await supabaseAdmin
    .from("shows")
    .select("id, key, title, contest, status, starts_at, ends_at")
    .in("status", ["live", "finished"])
    .order("starts_at", { ascending: true });
  const out: any[] = [];
  for (const s of (shows as any[]) ?? []) {
    const { data: w } = await supabaseAdmin
      .from("participants")
      .select("id, display_name, photo_url, crown, regions(name, country_id)")
      .eq("contest", s.contest ?? s.key)
      .in("crown", ["season", "region"])
      .limit(200);
    const winners = ((w as any[]) ?? [])
      .filter((p) => !cid || one(p.regions)?.country_id === cid)
      .map((p) => ({
      id: p.id,
      name: p.display_name,
      photo: p.photo_url,
      crown: p.crown,
      region: Array.isArray(p.regions) ? p.regions[0]?.name : p.regions?.name,
    }));
    const { data: aw } = await supabaseAdmin
      .from("show_awards")
      .select("id, season, nomination, participant_id, participants(display_name, photo_url, regions(country_id))")
      .eq("show_key", s.key)
      .order("created_at", { ascending: true });
    const awards = ((aw as any[]) ?? [])
      .filter((r) => !cid || one(one(r.participants)?.regions)?.country_id === cid)
      .map((r) => {
      const p = Array.isArray(r.participants) ? r.participants[0] : r.participants;
      return { id: r.participant_id, season: r.season, nomination: r.nomination, name: p?.display_name ?? "", photo: p?.photo_url ?? null };
    });
    out.push({ key: s.key, title: s.title, contest: s.contest ?? s.key, status: s.status, winners, awards });
  }
  return NextResponse.json({ ok: true, shows: out });
}
