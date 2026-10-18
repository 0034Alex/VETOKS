import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { countryOfRegion } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

const KINDS = ["impression", "view", "dwell", "click", "swipe", "skip", "close"];
const TYPES = ["banner", "logo", "magazine", "popup", "ticker", "directory"];
const ID = /^[\w:.-]{1,64}$/;
const short = (v: unknown, n: number) => (typeof v === "string" && v.length <= n ? v : null);

// Статистика рекламы: показы, просмотры, время на экране, клики, пролистывание.
// Страну и регион для вошедшего человека берём на сервере, а не от клиента.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const events: any[] = (Array.isArray(b.events) ? b.events : []).slice(0, 60);
  if (events.length === 0) return NextResponse.json({ ok: true });

  const uid = await userIdFromBearer(req);
  let country = short(b.country, 64);
  let region = short(b.region, 64);
  if (uid) {
    const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
    region = (u?.region_id as string) ?? null;
    country = await countryOfRegion(region);
  }
  const session = short(b.session, 40);
  const platform = short(b.platform, 30);
  const source = short(b.source, 80);

  const rows = events
    .filter((e) => KINDS.includes(e?.kind) && TYPES.includes(e?.type) && typeof e?.id === "string" && ID.test(e.id))
    .map((e) => ({
      kind: e.kind,
      target_type: e.type,
      target_id: e.id,
      placement: short(e.placement, 40),
      position: Number.isFinite(Number(e.position)) ? Math.max(0, Math.min(999, Math.floor(Number(e.position)))) : null,
      value: Number.isFinite(Number(e.value)) ? Math.max(0, Math.min(600000, Math.floor(Number(e.value)))) : null,
      user_id: uid,
      session_id: session,
      country_id: country,
      region_id: region,
      platform,
      is_new: !!b.isNew,
      logged_in: !!uid,
      referrer: source,
      created_at: Number.isFinite(Number(e.t)) && Math.abs(Date.now() - Number(e.t)) < 3600000 ? new Date(Number(e.t)).toISOString() : undefined,
    }));
  if (rows.length) await supabaseAdmin.from("ad_log").insert(rows);
  return NextResponse.json({ ok: true });
}
