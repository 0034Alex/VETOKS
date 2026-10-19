import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { sameCountry } from "@/lib/countryServer";
import { presenceState } from "@/lib/presence";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const rl = await rateLimit(req, "presence/get", 120, 60, me);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const id = String(b.userId ?? "");
  if (!id) return bad("no_user");
  if (id === me) return NextResponse.json({ ok: true, state: "online" });
  if (!(await sameCountry(me, id))) return NextResponse.json({ ok: true, state: "" });
  const { data: u, error } = await supabaseAdmin.from("users").select("last_seen_at, privacy, is_banned").eq("id", id).maybeSingle();
  if (error || !u || (u as any).is_banned) return NextResponse.json({ ok: true, state: "" });
  return NextResponse.json({ ok: true, state: presenceState((u as any).last_seen_at, (u as any).privacy) });
}
