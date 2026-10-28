import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

function allowed(me: any, countryId: string, write: boolean): boolean {
  if (me?.role === "super_admin") return true;
  const perm = (me?.permissions ?? {}).contest;
  if (!perm || !countryId) return false;
  if (write && perm === "r") return false;
  const cs = Array.isArray(me?.staff_countries) ? (me.staff_countries as string[]) : [];
  return cs.includes(countryId);
}

// CRM → «Конструктор шоу» → «Между шоу»: режим, блоки, вопрос недели и ответы людей.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "finance_admin", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const { data: me } = await supabaseAdmin.from("users").select("role, permissions, staff_countries").eq("id", uid).maybeSingle();
  const b = await req.json().catch(() => ({}));
  const cid = String(b.country_id ?? "");
  const write = b.action === "save";
  if (!cid || !allowed(me, cid, write)) return NextResponse.json({ ok: false, message: "Нет доступа к этой стране." }, { status: 403 });

  if (b.action === "save") {
    const mode = ["auto", "on", "off"].includes(b.mode) ? b.mode : "auto";
    const off = (Array.isArray(b.off) ? b.off : []).map((x: any) => String(x).replace(/[^a-z_]/g, "")).filter(Boolean).join(",");
    const rows = [
      { key: `between_mode:${cid}`, value: mode },
      { key: `between_off:${cid}`, value: off },
      { key: `between_question:${cid}`, value: String(b.question ?? "").trim().slice(0, 300) },
    ];
    const { error } = await supabaseAdmin.from("platform_settings").upsert(rows, { onConflict: "key" });
    if (error) return NextResponse.json({ ok: false, message: "Не получилось сохранить." });
    await logAction(uid, "between_save", cid, { mode });
    return NextResponse.json({ ok: true });
  }

  const keys = ["between_mode", "between_off", "between_question"].map((k) => `${k}:${cid}`);
  const { data: st } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", keys);
  const g = (k: string) => String(((st ?? []) as any[]).find((r) => r.key === `${k}:${cid}`)?.value ?? "");
  const { data: ans, error } = await supabaseAdmin
    .from("between_answers")
    .select("id, user_id, question, answer, created_at")
    .eq("country_id", cid)
    .order("created_at", { ascending: false })
    .limit(300);
  const ids = Array.from(new Set(((ans ?? []) as any[]).map((a) => a.user_id)));
  const { data: us } = ids.length ? await supabaseAdmin.from("users").select("id, first_name, regions(name)").in("id", ids) : { data: [] as any[] };
  const um = new Map<string, any>(((us ?? []) as any[]).map((u) => [u.id, u]));
  return NextResponse.json({
    ok: true,
    noTable: !!error,
    mode: g("between_mode") || "auto",
    off: g("between_off").split(",").filter(Boolean),
    question: g("between_question"),
    answers: ((ans ?? []) as any[]).map((a) => {
      const u = um.get(a.user_id);
      const r = Array.isArray(u?.regions) ? u.regions[0] : u?.regions;
      return { id: a.id, name: u?.first_name ?? "Без имени", region: r?.name ?? "", question: a.question, answer: a.answer, at: a.created_at };
    }),
  });
}
