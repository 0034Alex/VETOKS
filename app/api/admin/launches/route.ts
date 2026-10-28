import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { DEFAULT_STAGES, defaultItems, endIdx, startIdx, todayIdx, type LaunchRow, type Stage } from "@/lib/launch";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "live", "paused", "finished"];
const KINDS = ["block", "tip", "question", "task"];
const MODES = ["from", "end", "before"];
const DURS = ["stage", "days"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v: any, min: number, max: number, def: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const cleanStages = (v: any): Stage[] => {
  const arr = Array.isArray(v) ? v : [];
  const out = arr.slice(0, 12).map((s: any) => ({ name: String(s?.name ?? "").trim().slice(0, 40) || "Этап", days: int(s?.days, 1, 365, 7) }));
  return out.length ? out : DEFAULT_STAGES;
};

async function loadAll(countryId: string) {
  const { data: ls } = await supabaseAdmin.from("launches").select("*").eq("country_id", countryId).order("position", { ascending: true });
  const launches = ((ls as LaunchRow[]) ?? []).map((l) => ({ ...l, stages: Array.isArray(l.stages) ? l.stages : [] }));
  return launches;
}

// Одно шоу в стране за раз: активные запуски не должны пересекаться по дням.
async function overlapMessage(l: LaunchRow): Promise<string | null> {
  const all = await loadAll(l.country_id);
  const me = all.find((x) => x.id === l.id) ?? l;
  const s = startIdx(me, all);
  const e = endIdx(me, all);
  if (s === null || e === null) return "У запуска не задана дата старта (или «после какого шоу»).";
  for (const o of all) {
    if (o.id === me.id || !["live", "paused"].includes(o.status)) continue;
    const os = startIdx(o, all);
    const oe = endIdx(o, all);
    if (os === null || oe === null) continue;
    if (s <= oe && e >= os) return `Пересекается с запуском «${o.show_key}» (${o.status === "paused" ? "на паузе" : "идёт"}). В одной стране идёт одно шоу.`;
  }
  return null;
}

// CRM → «Страны и запуск» (только владелец).
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "list") {
    const cid = String(b.country_id ?? "");
    if (!cid) return NextResponse.json({ ok: false, message: "Выберите страну." });
    const launches = await loadAll(cid);
    const { data: it } = launches.length
      ? await supabaseAdmin.from("launch_items").select("*").in("launch_id", launches.map((l) => l.id)).order("sort", { ascending: true })
      : { data: [] as any[] };
    const { data: shows } = await supabaseAdmin.from("shows").select("key,title").order("created_at", { ascending: true });
    return NextResponse.json({ ok: true, launches, items: it ?? [], shows: shows ?? [], today: todayIdx("Europe/Kyiv") });
  }

  if (b.action === "create") {
    const cid = String(b.country_id ?? "");
    const key = String(b.show_key ?? "").trim();
    if (!cid || !key) return NextResponse.json({ ok: false, message: "Выберите страну и шоу." });
    const { data: sh } = await supabaseAdmin.from("shows").select("key").eq("key", key).maybeSingle();
    if (!sh) return NextResponse.json({ ok: false, message: "Такого шоу нет в разделе «Шоу»." });
    const existing = await loadAll(cid);
    const last = existing[existing.length - 1];
    const row = {
      country_id: cid,
      show_key: key,
      status: "draft",
      start_date: last ? null : null,
      after_id: last ? last.id : null,
      after_offset: 0,
      stages: DEFAULT_STAGES,
      position: existing.length,
    };
    const { data, error } = await supabaseAdmin.from("launches").insert(row).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ ok: false, message: error?.message || "Не получилось создать." });
    await supabaseAdmin.from("launch_items").insert(defaultItems().map((i) => ({ ...i, launch_id: data.id })));
    await logAction(uid, "launch_create", data.id, { cid, key });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (b.action === "save") {
    const id = String(b.id ?? "");
    const patch: Record<string, any> = {};
    if (b.show_key !== undefined) patch.show_key = String(b.show_key).slice(0, 40);
    if (b.stages !== undefined) patch.stages = cleanStages(b.stages);
    if (b.tz !== undefined) patch.tz = String(b.tz).trim().slice(0, 60) || "Europe/Kyiv";
    if (b.start_date !== undefined) {
      if (b.start_date && !DATE.test(String(b.start_date))) return NextResponse.json({ ok: false, message: "Неверная дата." });
      patch.start_date = b.start_date || null;
    }
    if (b.after_id !== undefined) patch.after_id = b.after_id && b.after_id !== id ? String(b.after_id) : null;
    if (b.after_offset !== undefined) patch.after_offset = int(b.after_offset, -60, 365, 0);
    const { error } = await supabaseAdmin.from("launches").update(patch).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "launch_save", id, Object.keys(patch) as any);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "status") {
    const id = String(b.id ?? "");
    const st = String(b.status ?? "");
    if (!STATUSES.includes(st)) return NextResponse.json({ ok: false, message: "Неверный статус." });
    const { data: l } = await supabaseAdmin.from("launches").select("*").eq("id", id).maybeSingle();
    if (!l) return NextResponse.json({ ok: false, message: "Запуск не найден." });
    if (st === "live") {
      const m = await overlapMessage(l as LaunchRow);
      if (m) return NextResponse.json({ ok: false, message: m });
    }
    const { error } = await supabaseAdmin.from("launches").update({ status: st }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "launch_status", id, { st });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "shift") {
    const id = String(b.id ?? "");
    const days = int(b.days, -30, 30, 0);
    const { data: l } = await supabaseAdmin.from("launches").select("start_date,after_id,after_offset").eq("id", id).maybeSingle();
    if (!l) return NextResponse.json({ ok: false, message: "Запуск не найден." });
    const patch: Record<string, any> = {};
    if (l.after_id) patch.after_offset = int((l.after_offset ?? 0) + days, -60, 365, 0);
    else if (l.start_date) {
      const d = new Date(l.start_date + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      patch.start_date = d.toISOString().slice(0, 10);
    } else return NextResponse.json({ ok: false, message: "Сначала задайте дату старта." });
    await supabaseAdmin.from("launches").update(patch).eq("id", id);
    await logAction(uid, "launch_shift", id, { days });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete") {
    const id = String(b.id ?? "");
    await supabaseAdmin.from("launches").update({ after_id: null }).eq("after_id", id);
    const { error } = await supabaseAdmin.from("launches").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "launch_delete", id, {});
    return NextResponse.json({ ok: true });
  }

  // Копия запуска в другую страну (черновик): программа переносится, даты считаются от нового старта.
  if (b.action === "copy") {
    const id = String(b.id ?? "");
    const cid = String(b.country_id ?? "");
    if (!cid) return NextResponse.json({ ok: false, message: "Выберите страну." });
    const { data: l } = await supabaseAdmin.from("launches").select("*").eq("id", id).maybeSingle();
    if (!l) return NextResponse.json({ ok: false, message: "Запуск не найден." });
    const existing = await loadAll(cid);
    const last = existing[existing.length - 1];
    const { data: nl, error } = await supabaseAdmin
      .from("launches")
      .insert({ country_id: cid, show_key: l.show_key, status: "draft", start_date: null, after_id: last ? last.id : null, after_offset: 0, stages: l.stages, position: existing.length, tz: l.tz })
      .select("id")
      .maybeSingle();
    if (error || !nl) return NextResponse.json({ ok: false, message: error?.message || "Не получилось скопировать." });
    const { data: its } = await supabaseAdmin.from("launch_items").select("*").eq("launch_id", id);
    if (its?.length) {
      await supabaseAdmin.from("launch_items").insert(its.map((i: any) => ({ ...i, id: undefined, launch_id: nl.id })));
    }
    await logAction(uid, "launch_copy", nl.id, { from: id, cid });
    return NextResponse.json({ ok: true, id: nl.id });
  }

  if (b.action === "item_save") {
    const kind = String(b.kind ?? "");
    if (!KINDS.includes(kind)) return NextResponse.json({ ok: false, message: "Неверный тип." });
    const row: Record<string, any> = {
      kind,
      block_key: kind === "block" ? String(b.block_key ?? "").slice(0, 30) || null : null,
      title: String(b.title ?? "").slice(0, 120),
      body: String(b.body ?? "").slice(0, 1000),
      enabled: b.enabled !== false,
      stage: int(b.stage, 0, 11, 0),
      start_mode: MODES.includes(b.start_mode) ? b.start_mode : "from",
      start_n: int(b.start_n, 0, 365, 0),
      dur_mode: DURS.includes(b.dur_mode) ? b.dur_mode : "stage",
      dur_n: int(b.dur_n, 1, 365, 1),
      sort: int(b.sort, 0, 9999, 0),
    };
    if (b.id) {
      const { error } = await supabaseAdmin.from("launch_items").update(row).eq("id", b.id);
      if (error) return NextResponse.json({ ok: false, message: error.message });
      return NextResponse.json({ ok: true, id: b.id });
    }
    const { data, error } = await supabaseAdmin.from("launch_items").insert({ ...row, launch_id: String(b.launch_id ?? "") }).select("id").maybeSingle();
    if (error) return NextResponse.json({ ok: false, message: error.message });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  if (b.action === "item_delete") {
    const { error } = await supabaseAdmin.from("launch_items").delete().eq("id", String(b.id ?? ""));
    if (error) return NextResponse.json({ ok: false, message: error.message });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Неизвестное действие." });
}
