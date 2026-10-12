import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind;
  const type = body.type;
  if (!["view", "click"].includes(kind) || !["banner", "logo"].includes(type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ids: string[] = (Array.isArray(body.ids) ? body.ids : []).filter((x: any) => typeof x === "string" && UUID.test(x)).slice(0, 40);
  if (ids.length === 0) return NextResponse.json({ ok: true });
  await supabaseAdmin.from("ad_events").insert(ids.map((id) => ({ kind, target_type: type, target_id: id })));
  return NextResponse.json({ ok: true });
}
