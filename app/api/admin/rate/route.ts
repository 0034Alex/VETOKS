import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

const sk = (k: string, cid: string | null) => (cid ? `${k}:${cid}` : k);

// Дашборд: ежедневный курс $ и его история.
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const cid: string | null = body.countryId ? String(body.countryId) : null;

  if (body.action === "history") {
    let q = supabaseAdmin.from("rate_history").select("*").order("created_at", { ascending: false }).limit(15);
    q = cid ? q.eq("country_id", cid) : q.is("country_id", null);
    const { data, error } = await q;
    return NextResponse.json({ ok: true, items: error ? [] : data ?? [], tableOk: !error });
  }

  if (body.action === "set") {
    const rate = Number(String(body.rate).replace(",", "."));
    if (!(rate > 0) || rate > 1e6) return NextResponse.json({ ok: false, error: "bad_rate" }, { status: 400 });

    // Цены в приложении (в монетах) не должны плыть вместе с курсом: до первой смены фиксируем множитель.
    const keys = [sk("coins_per_usd", cid), sk("usd_to_uah_rate", cid), "coins_per_usd", "usd_to_uah_rate"];
    const { data: cur } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", keys);
    const m: Record<string, string> = {};
    (cur ?? []).forEach((r: any) => (m[r.key] = r.value));
    const hasK = Number(m[sk("coins_per_usd", cid)] ?? m["coins_per_usd"]) > 0;
    const oldRate = Number(m[sk("usd_to_uah_rate", cid)] ?? m["usd_to_uah_rate"]);
    if (!hasK && oldRate > 0) await supabaseAdmin.from("platform_settings").upsert({ key: sk("coins_per_usd", cid), value: String(oldRate) });

    await supabaseAdmin.from("platform_settings").upsert({ key: sk("usd_to_uah_rate", cid), value: String(rate) });
    const { data: me } = await supabaseAdmin.from("users").select("first_name").eq("id", uid).maybeSingle();
    const { error } = await supabaseAdmin.from("rate_history").insert({ country_id: cid, rate, changed_by: me?.first_name ?? null });
    await logAction(uid, "usd_rate", null, { rate, country: cid });
    return NextResponse.json({ ok: true, historyOk: !error });
  }
  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
