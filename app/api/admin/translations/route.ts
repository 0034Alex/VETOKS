import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { isLang } from "@/lib/langs";

export const dynamic = "force-dynamic";

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);

// CRM → «Переводы»: посмотреть и поправить автопереводы.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin", "moderator"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const a = body.action;

  if (a === "list") {
    const q = String(body.query ?? "").trim().replace(/[%,()]/g, "").slice(0, 60);
    let qb = supabaseAdmin.from("translations").select("lang, h, src, text, manual, updated_at").order("updated_at", { ascending: false }).limit(60);
    if (isLang(body.lang)) qb = qb.eq("lang", body.lang);
    if (q) qb = qb.or(`src.ilike.%${q}%,text.ilike.%${q}%`);
    const { data, error } = await qb;
    if (error) return NextResponse.json({ ok: false, error: "no_table" });
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (a === "save") {
    const lang = body.lang;
    const h = String(body.h ?? "");
    const text = String(body.text ?? "").trim().slice(0, 1500);
    if (!isLang(lang) || !h || !text) return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("translations")
      .update({ text, manual: true, updated_at: new Date().toISOString() })
      .eq("lang", lang)
      .eq("h", h);
    if (error) return NextResponse.json({ ok: false, error: "db" });
    await logAction(uid, "translation_edit", null, { lang, h });
    return NextResponse.json({ ok: true });
  }

  if (a === "delete") {
    const lang = body.lang;
    const h = String(body.h ?? "");
    if (!isLang(lang) || !h) return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
    await supabaseAdmin.from("translations").delete().eq("lang", lang).eq("h", h);
    return NextResponse.json({ ok: true });
  }

  if (a === "add") {
    const lang = body.lang;
    const src = String(body.src ?? "").trim().slice(0, 800);
    const text = String(body.text ?? "").trim().slice(0, 1500);
    if (!isLang(lang) || !src || !text) return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("translations")
      .upsert({ lang, h: hash(src), src, text, manual: true, updated_at: new Date().toISOString() }, { onConflict: "lang,h" });
    if (error) return NextResponse.json({ ok: false, error: "db" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "action" }, { status: 400 });
}
