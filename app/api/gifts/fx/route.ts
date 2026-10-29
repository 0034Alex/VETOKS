import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Подарки участницы, которые она ещё не «посмотрела» на экране.
// action: "unseen" — новые (для показа при входе / онлайн), "replay" — ещё не пересмотренные,
//         "ack" — отметить: seen (показаны при входе) и played (посмотрены).
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "unseen");

  const { data: ps } = await supabaseAdmin.from("participants").select("id").eq("user_id", uid);
  const pids = (ps ?? []).map((p: any) => p.id);
  if (!pids.length) return NextResponse.json({ ok: true, pids: [], items: [] });

  try {
    if (action === "ack") {
      const now = new Date().toISOString();
      const seen: string[] = Array.isArray(body.seen) ? body.seen.slice(0, 200).map(String) : [];
      const played: string[] = Array.isArray(body.played) ? body.played.slice(0, 200).map(String) : [];
      if (seen.length) await supabaseAdmin.from("gifts").update({ fx_seen_at: now }).in("id", seen).in("participant_id", pids);
      if (played.length) await supabaseAdmin.from("gifts").update({ fx_played_at: now, fx_seen_at: now }).in("id", played).in("participant_id", pids);
      return NextResponse.json({ ok: true });
    }

    let q = supabaseAdmin
      .from("gifts")
      .select("id, sender_id, quantity, total_price, created_at, participant_id, gift_catalog(*)")
      .in("participant_id", pids)
      .order("created_at", { ascending: false })
      .limit(40);
    q = action === "replay" ? q.is("fx_played_at", null) : q.is("fx_seen_at", null);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: true, pids, items: [] });

    const sids = Array.from(new Set((data ?? []).map((g: any) => g.sender_id).filter(Boolean)));
    const names: Record<string, { n: string | null; p: string | null }> = {};
    if (sids.length) {
      const { data: us } = await supabaseAdmin.from("users").select("id, first_name, photo_url").in("id", sids as string[]);
      (us ?? []).forEach((u: any) => (names[u.id] = { n: u.first_name, p: u.photo_url }));
    }
    const items = (data ?? []).map((g: any) => {
      const c = Array.isArray(g.gift_catalog) ? g.gift_catalog[0] : g.gift_catalog;
      return {
        id: g.id,
        name: c?.name ?? "Подарок",
        art: c?.art ?? null,
        category: c?.category ?? null,
        usd: Number(c?.usd_price) || 0,
        fx: c?.fx ?? null,
        qty: g.quantity ?? 1,
        total: Number(g.total_price) || 0,
        from: names[g.sender_id]?.n || "Зритель",
        avatar: names[g.sender_id]?.p ?? null,
      };
    });
    return NextResponse.json({ ok: true, pids, items });
  } catch {
    return NextResponse.json({ ok: true, pids, items: [] });
  }
}
