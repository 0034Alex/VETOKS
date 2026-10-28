import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { BLOCKS, COUNTRY_TZ, DEFAULT_STAGES, defaultItems, endIdx, startIdx, todayIdx, type LaunchRow, type Stage } from "@/lib/launch";

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

// Номер дня (от 1970-01-01) для момента времени в часовом поясе страны.
function startIdx0(iso: string, tz: string): number {
  const d = new Date(iso);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return Math.floor(Date.parse(ymd + "T00:00:00Z") / 86400000);
}

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

async function launchCountry(id: string): Promise<string | undefined> {
  const { data } = await supabaseAdmin.from("launches").select("country_id").eq("id", id).maybeSingle();
  return (data?.country_id as string) ?? undefined;
}
async function itemCountry(id: string): Promise<string | undefined> {
  const { data } = await supabaseAdmin.from("launch_items").select("launch_id").eq("id", id).maybeSingle();
  return data ? launchCountry(data.launch_id as string) : undefined;
}

// Владелец — всё. «Менеджер страны» — сотрудник с правом «Конкурс» и своими странами (галочки в «Персонал»).
function allowed(me: any, countryId: string | undefined, write: boolean): boolean {
  if (me?.role === "super_admin") return true;
  const perm = (me?.permissions ?? {}).contest;
  if (!perm || !countryId) return false;
  if (write && perm === "r") return false;
  const cs = Array.isArray(me?.staff_countries) ? (me.staff_countries as string[]) : [];
  return cs.length > 0 && cs.includes(countryId);
}

// CRM → «Страны и запуск» (владелец и менеджеры стран).
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "finance_admin", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const { data: me } = await supabaseAdmin.from("users").select("role, permissions, staff_countries").eq("id", uid).maybeSingle();
  const a = String(b.action ?? "");

  if (a === "publish" || a === "publish_preview") {
    if (me?.role !== "super_admin") return NextResponse.json({ ok: false, message: "Публикация шаблона — только владелец." }, { status: 403 });
  } else {
    let target: string | undefined;
    if (a === "list" || a === "create" || a === "import_season") target = String(b.country_id ?? "");
    else if (["save", "status", "shift", "delete", "copy"].includes(a)) target = await launchCountry(String(b.id ?? ""));
    else if (a === "item_save") target = b.id ? await itemCountry(String(b.id)) : await launchCountry(String(b.launch_id ?? ""));
    else if (a === "item_delete") target = await itemCountry(String(b.id ?? ""));
    if (!allowed(me, target, a !== "list") || (a === "copy" && !allowed(me, String(b.country_id ?? ""), true))) {
      return NextResponse.json({ ok: false, message: "Нет доступа к этой стране." }, { status: 403 });
    }
  }

  // «Опубликовать» шаблон: добавляет во все запуски новые блоки (то, чего там ещё нет).
  // Существующие блоки, тексты, подсказки и вопросы стран не трогаем.
  if (a === "publish_preview" || a === "publish") {
    const { data: ls } = await supabaseAdmin.from("launches").select("id, status");
    const ids = ((ls as any[]) ?? []).filter((l) => l.status !== "finished").map((l) => l.id as string);
    const { data: its } = ids.length ? await supabaseAdmin.from("launch_items").select("launch_id, block_key").eq("kind", "block").in("launch_id", ids) : { data: [] as any[] };
    const have = new Map<string, Set<string>>();
    (its ?? []).forEach((i: any) => {
      if (!have.has(i.launch_id)) have.set(i.launch_id, new Set());
      have.get(i.launch_id)!.add(i.block_key);
    });
    const rows: any[] = [];
    ids.forEach((id) =>
      BLOCKS.forEach((bl, n) => {
        if (!have.get(id)?.has(bl.key)) rows.push({ launch_id: id, kind: "block", block_key: bl.key, title: "", body: "", enabled: true, stage: bl.stage, start_mode: bl.start_mode, start_n: bl.start_n, dur_mode: bl.dur_mode, dur_n: bl.dur_n, sort: n });
      })
    );
    const launchesTouched = new Set(rows.map((r) => r.launch_id)).size;
    const blocks = Array.from(new Set(rows.map((r) => r.block_key)));
    if (a === "publish" && rows.length) {
      const { error } = await supabaseAdmin.from("launch_items").insert(rows);
      if (error) return NextResponse.json({ ok: false, message: error.message });
      await logAction(uid, "launch_publish", null, { added: rows.length, launches: launchesTouched });
    }
    return NextResponse.json({ ok: true, count: rows.length, launches: launchesTouched, blocks });
  }

  if (a === "list") {
    const cid = String(b.country_id ?? "");
    if (!cid) return NextResponse.json({ ok: false, message: "Выберите страну." });
    const launches = await loadAll(cid);
    const { data: it } = launches.length
      ? await supabaseAdmin.from("launch_items").select("*").in("launch_id", launches.map((l) => l.id)).order("sort", { ascending: true })
      : { data: [] as any[] };
    const { data: shows } = await supabaseAdmin.from("shows").select("key,title").order("created_at", { ascending: true });
    return NextResponse.json({ ok: true, launches, items: it ?? [], shows: shows ?? [], today: todayIdx("Europe/Kyiv") });
  }

  // Перенос текущего сезона страны в запуск (например Мисс Украина): этапы и даты берутся из сезона.
  if (a === "import_season") {
    const cid = String(b.country_id ?? "");
    const key = String(b.show_key ?? "miss").trim();
    if (!cid) return NextResponse.json({ ok: false, message: "Выберите страну." });
    const { data: sh } = await supabaseAdmin.from("shows").select("key").eq("key", key).maybeSingle();
    if (!sh) return NextResponse.json({ ok: false, message: `Шоу «${key}» нет в «Шаблоны шоу». Создайте его там.` });
    const { data: se } = await supabaseAdmin.from("seasons").select("*").eq("country_id", cid).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!se) return NextResponse.json({ ok: false, message: "В этой стране нет сезона." });
    const { data: st } = await supabaseAdmin.from("season_stages").select("title, ends_at, stage_number").eq("season_id", (se as any).id).order("stage_number", { ascending: true });
    const list = ((st as any[]) ?? []).filter((x) => x.ends_at);
    if (!list.length) return NextResponse.json({ ok: false, message: "У сезона нет этапов с датами окончания." });
    const { data: ctry } = await supabaseAdmin.from("countries").select("code").eq("id", cid).maybeSingle();
    const tz = COUNTRY_TZ[String((ctry as any)?.code ?? "").toUpperCase()] || "Europe/Kyiv";
    const day = (v: string) => startIdx0(v, tz);
    const first = String((se as any).starts_at ?? (se as any).start_date ?? (se as any).created_at ?? list[0].ends_at);
    let prev = day(first);
    const stages = list.map((x: any, n: number) => {
      const end = day(String(x.ends_at));
      const days = Math.max(1, end - prev + (n === 0 ? 1 : 0));
      prev = end;
      return { name: String(x.title || `Этап ${n + 1}`).slice(0, 40), days: Math.min(365, days) };
    });
    const existing = await loadAll(cid);
    const startStr = new Date(day(first) * 86400000).toISOString().slice(0, 10);
    const row = { country_id: cid, show_key: key, tz, status: "draft", start_date: startStr, after_id: null, after_offset: 0, stages, position: existing.length };
    const { data, error } = await supabaseAdmin.from("launches").insert(row).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ ok: false, message: error?.message || "Не получилось создать." });
    await supabaseAdmin.from("launch_items").insert(defaultItems().map((i) => ({ ...i, launch_id: data.id })));
    await logAction(uid, "launch_import_season", data.id, { cid, key, stages: stages.length });
    return NextResponse.json({ ok: true, id: data.id, stages: stages.length, start: startStr });
  }

  if (a === "create") {
    const cid = String(b.country_id ?? "");
    const key = String(b.show_key ?? "").trim();
    if (!cid || !key) return NextResponse.json({ ok: false, message: "Выберите страну и шоу." });
    const { data: sh } = await supabaseAdmin.from("shows").select("key").eq("key", key).maybeSingle();
    if (!sh) return NextResponse.json({ ok: false, message: "Такого шоу нет в разделе «Шоу»." });
    const existing = await loadAll(cid);
    const last = existing[existing.length - 1];
    const { data: ctry } = await supabaseAdmin.from("countries").select("code").eq("id", cid).maybeSingle();
    const tz = COUNTRY_TZ[String((ctry as any)?.code ?? "").toUpperCase()] || "Europe/Kyiv";
    const row = {
      country_id: cid,
      show_key: key,
      tz,
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

  if (a === "save") {
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

  if (a === "status") {
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

  if (a === "shift") {
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

  if (a === "delete") {
    const id = String(b.id ?? "");
    await supabaseAdmin.from("launches").update({ after_id: null }).eq("after_id", id);
    const { error } = await supabaseAdmin.from("launches").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message });
    await logAction(uid, "launch_delete", id, {});
    return NextResponse.json({ ok: true });
  }

  // Копия запуска в другую страну (черновик): программа переносится, даты считаются от нового старта.
  if (a === "copy") {
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

  if (a === "item_save") {
    const kind = String(b.kind ?? "");
    if (!KINDS.includes(kind)) return NextResponse.json({ ok: false, message: "Неверный тип." });
    const row: Record<string, any> = {
      kind,
      block_key: kind === "block" ? String(b.block_key ?? "").slice(0, 30) || null : null,
      title: String(b.title ?? "").slice(0, 120),
      body: String(b.body ?? "").slice(0, 1000),
      enabled: b.enabled !== false,
      stage: int(b.stage, -1, 11, 0),
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

  if (a === "item_delete") {
    const { error } = await supabaseAdmin.from("launch_items").delete().eq("id", String(b.id ?? ""));
    if (error) return NextResponse.json({ ok: false, message: error.message });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Неизвестное действие." });
}
