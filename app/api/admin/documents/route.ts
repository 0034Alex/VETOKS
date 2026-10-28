import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const a = body.action;
  const { data: me } = await supabaseAdmin.from("users").select("role, staff_countries").eq("id", uid).maybeSingle();
  // Владелец правит всё. Сотрудник со своими странами — только документы этих стран (стандартные только читает).
  const limited = me?.role !== "super_admin" && Array.isArray(me?.staff_countries) && (me!.staff_countries as string[]).length > 0;
  const mineC = limited ? (me!.staff_countries as string[]) : null;
  const okFor = (c: string | null | undefined) => !mineC || (!!c && mineC.includes(c));

  if (a === "list") {
    let q = await supabaseAdmin
      .from("documents")
      .select("id, title, content, audience, is_active, version, updated_at, sort_order, show_at, country_id")
      .order("sort_order", { ascending: true });
    if (q.error) {
      q = (await supabaseAdmin
        .from("documents")
        .select("id, title, content, audience, is_active, version, updated_at, sort_order, show_at")
        .order("sort_order", { ascending: true })) as any;
    }
    let docs = (q.data ?? []) as any[];
    if (mineC) docs = docs.filter((d) => !d.country_id || mineC.includes(d.country_id));
    return NextResponse.json({ ok: true, docs });
  }

  if (a === "create") {
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!title || !content) return NextResponse.json({ ok: false }, { status: 400 });
    const cid = body.country_id ? String(body.country_id).slice(0, 64) : null;
    if (!okFor(cid)) return NextResponse.json({ ok: false, message: "Нет доступа к этой стране." }, { status: 403 });
    const { count } = await supabaseAdmin.from("documents").select("id", { count: "exact", head: true });
    const row: Record<string, any> = {
      title,
      content,
      audience: ["all", "participants", "partner"].includes(body.audience) ? body.audience : "all",
      sort_order: count ?? 0,
      version: 1,
    };
    if (cid) row.country_id = cid;
    const { error: ie } = await supabaseAdmin.from("documents").insert(row);
    if (ie) return NextResponse.json({ ok: false, message: ie.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  if (mineC) {
    const { data: dd } = await supabaseAdmin.from("documents").select("country_id").eq("id", id).maybeSingle();
    if (!okFor((dd as any)?.country_id)) return NextResponse.json({ ok: false, message: "Этот документ другой страны или стандартный." }, { status: 403 });
  }

  if (a === "versions") {
    const { data } = await supabaseAdmin
      .from("document_versions")
      .select("id, version, title, content, created_at")
      .eq("document_id", id)
      .order("version", { ascending: false })
      .limit(30);
    return NextResponse.json({ ok: true, versions: data ?? [] });
  }

  // Сохранение правки: старый текст уходит в историю, версия растёт.
  if (a === "save" || a === "restore") {
    const { data: cur } = await supabaseAdmin
      .from("documents")
      .select("title, content, version")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ ok: false }, { status: 404 });

    let title = String(body.title ?? cur.title);
    let content = String(body.content ?? cur.content);
    if (a === "restore") {
      const { data: v } = await supabaseAdmin
        .from("document_versions")
        .select("title, content")
        .eq("id", String(body.versionId ?? ""))
        .eq("document_id", id)
        .maybeSingle();
      if (!v) return NextResponse.json({ ok: false }, { status: 404 });
      title = v.title;
      content = v.content;
    }
    if (title === cur.title && content === cur.content) return NextResponse.json({ ok: true, unchanged: true });

    const ver = Number(cur.version ?? 1);
    await supabaseAdmin.from("document_versions").insert({
      document_id: id,
      version: ver,
      title: cur.title,
      content: cur.content,
      created_by: uid,
    });
    await supabaseAdmin
      .from("documents")
      .update({ title, content, version: ver + 1, updated_at: new Date().toISOString() })
      .eq("id", id);
    await logAction(uid, a === "restore" ? "doc_restore" : "doc_edit", null, { document: id, from_version: ver });
    return NextResponse.json({ ok: true });
  }

  if (a === "show_at") {
    const v = ["register", "apply", "both"].includes(body.value) ? body.value : "";
    const { error } = await supabaseAdmin.from("documents").update({ show_at: v }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: "need_sql" }, { status: 500 });
    await logAction(uid, "doc_show_at", null, { document: id, value: v });
    return NextResponse.json({ ok: true });
  }

  if (a === "set_country") {
    const cid = body.country_id ? String(body.country_id).slice(0, 64) : null;
    if (!okFor(cid)) return NextResponse.json({ ok: false, message: "Нет доступа к этой стране." }, { status: 403 });
    const { error } = await supabaseAdmin.from("documents").update({ country_id: cid }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: "need_sql" }, { status: 500 });
    await logAction(uid, "doc_country", null, { document: id, country: cid });
    return NextResponse.json({ ok: true });
  }

  if (a === "toggle") {
    await supabaseAdmin.from("documents").update({ is_active: !!body.active }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (a === "delete") {
    await supabaseAdmin.from("document_versions").delete().eq("document_id", id);
    await supabaseAdmin.from("documents").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
