import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "scheduled", "live", "finished"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const iso = (v: any) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// CRM → «Шоу» (только владелец).
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const { data } = await supabaseAdmin.from("shows").select("*").order("created_at", { ascending: true });
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  if (b.action === "save") {
    const title = String(b.title ?? "").trim().slice(0, 80);
    let key = String(b.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
    if (!key && !b.id) key = "show-" + randomBytes(3).toString("hex");
    if (!title) return NextResponse.json({ ok: false, message: "Укажите название шоу." });
    const status = STATUSES.includes(b.status) ? b.status : "draft";
    const theme: Record<string, string> = {};
    for (const k of ["gold", "goldSoft", "sec", "sec2", "bg", "surface"]) {
      const v = b.theme?.[k];
      if (typeof v === "string" && HEX.test(v)) theme[k] = v;
    }
    const bn = b.banner && typeof b.banner === "object" ? b.banner : {};
    const banner = {
      image: typeof bn.image === "string" ? bn.image.slice(0, 500) : "",
      title: String(bn.title ?? "").slice(0, 80),
      subtitle: String(bn.subtitle ?? "").slice(0, 140),
      stage_label: String(bn.stage_label ?? "").slice(0, 60),
      poll_question: String(bn.poll_question ?? "").slice(0, 200),
      countdown_to: iso(bn.countdown_to),
      apply: bn.apply !== false,
    };
    const row: Record<string, any> = {
      banner,
      title,
      contest: String(b.contest ?? "").trim().toLowerCase().slice(0, 30) || key || undefined,
      status,
      theme,
      apply_open_at: iso(b.apply_open_at),
      starts_at: iso(b.starts_at),
      ends_at: iso(b.ends_at),
    };
    if (status === "scheduled" && !row.starts_at) return NextResponse.json({ ok: false, message: "Для статуса «Запланировано» укажите дату старта." });
    if (key) row.key = key;
    if (b.id) {
      const { error } = await supabaseAdmin.from("shows").update(row).eq("id", b.id);
      if (error) return NextResponse.json({ ok: false, message: error.message });
      await logAction(uid, "show_save", b.id, { key, status });
      return NextResponse.json({ ok: true, id: b.id });
    }
    const { data, error } = await supabaseAdmin.from("shows").insert(row).select("id").maybeSingle();
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "show_create", data?.id ?? null, { key });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  if (b.action === "token") {
    const t = randomBytes(12).toString("hex");
    const { error } = await supabaseAdmin.from("shows").update({ preview_token: t }).eq("id", b.id);
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "show_token", b.id, {});
    return NextResponse.json({ ok: true, token: t });
  }

  if (b.action === "delete") {
    const { data } = await supabaseAdmin.from("shows").select("status").eq("id", b.id).maybeSingle();
    if (!data || data.status !== "draft") return NextResponse.json({ ok: false, message: "Удалить можно только черновик." });
    await supabaseAdmin.from("shows").delete().eq("id", b.id);
    await logAction(uid, "show_delete", b.id, {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
