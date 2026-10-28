import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { consentDocs } from "@/lib/consents";

export const dynamic = "force-dynamic";

// Публичные документы для регистрации и анкеты: список и текст. Показываем только те, что отмечены в CRM.
export async function POST(req: Request) {
  const rl = await rateLimit(req, "documents/public", 60, 60);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  if (b.id) {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, title, content, version, updated_at, is_active, show_at")
      .eq("id", String(b.id))
      .maybeSingle();
    if (error || !data || !(data as any).is_active || !(data as any).show_at) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const d = data as any;
    return NextResponse.json({ ok: true, doc: { title: d.title, content: d.content, version: d.version, updated_at: d.updated_at } });
  }

  const place = b.place === "apply" ? "apply" : "register";
  const cid = typeof b.countryId === "string" && b.countryId.length < 64 ? b.countryId : null;
  return NextResponse.json({ ok: true, docs: await consentDocs(place, cid) });
}
