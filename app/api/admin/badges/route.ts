import { NextResponse } from "next/server";
import { regionIdsOfCountry } from "@/lib/countryServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { notify } from "@/lib/shopServer";
import { ambassadorDefault, AMB_DEFAULT_KEY, AMB_SHARE_KEY, ambassadorShareValue } from "@/lib/ambassador";
import { CONTESTS, STAGE_OPTIONS } from "@/lib/status";

export const dynamic = "force-dynamic";

const CROWNS = ["", "region", "season"];

// CRM → «Галочки и статусы».
export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const a = body.action;

  const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
  const isOwner = me?.role === "super_admin";

  if (a === "find") {
    const q = String(body.query ?? "").trim().replace(/[%,()]/g, "").slice(0, 60);
    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });
    const nick = q.replace(/^@/, "").toLowerCase();
    const ids = new Set<string>();
    const add = (rows: any[] | null) => (rows ?? []).forEach((r) => ids.add(r.id ?? r.user_id));
    const sel = "id";
    add((await supabaseAdmin.from("users").select(sel).ilike("first_name", `%${q}%`).limit(10)).data);
    add((await supabaseAdmin.from("users").select(sel).eq("nick", nick).limit(3)).data);
    add((await supabaseAdmin.from("users").select(sel).ilike("email", `%${q}%`).limit(5)).data);
    if (/\d{4,}/.test(q)) add((await supabaseAdmin.from("users").select(sel).ilike("phone", `%${q.replace(/\D/g, "")}%`).limit(5)).data);
    add((await supabaseAdmin.from("participants").select("user_id").ilike("display_name", `%${q}%`).limit(10)).data);
    const list = Array.from(ids).slice(0, 15);
    if (!list.length) return NextResponse.json({ ok: true, items: [] });
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, first_name, nick, phone, email, verified_badge, badge_note, region_id, regions(name)")
      .in("id", list);
    const { data: parts } = await supabaseAdmin
      .from("participants")
      .select("id, user_id, display_name, contest, stage_key, crown, is_eliminated, is_ambassador, ambassador_bonus")
      .in("user_id", list);
    const byUser: Record<string, any> = {};
    (parts ?? []).forEach((p: any) => (byUser[p.user_id] = p));
    const rids = body.countryId ? new Set(await regionIdsOfCountry(String(body.countryId))) : null;
    const items = (users ?? []).filter((u: any) => !rids || !u.region_id || rids.has(u.region_id)).map((u: any) => ({
      userId: u.id,
      name: byUser[u.id]?.display_name ?? u.first_name ?? "Без имени",
      nick: u.nick ?? null,
      contact: u.email ?? u.phone ?? "",
      region: Array.isArray(u.regions) ? u.regions[0]?.name : u.regions?.name ?? null,
      badge: !!u.verified_badge,
      badgeNote: u.badge_note ?? "",
      participant: byUser[u.id]
        ? {
            id: byUser[u.id].id,
            contest: byUser[u.id].contest ?? "miss",
            stage: byUser[u.id].stage_key ?? "selection",
            crown: byUser[u.id].crown ?? "",
            eliminated: !!byUser[u.id].is_eliminated,
            ambassador: !!byUser[u.id].is_ambassador,
            ambBonus: byUser[u.id].ambassador_bonus ?? null,
          }
        : null,
    }));
    return NextResponse.json({ ok: true, items });
  }

  if (a === "list_badges") {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, first_name, nick, badge_note, badge_at")
      .eq("verified_badge", true)
      .order("badge_at", { ascending: false })
      .limit(200);
    return NextResponse.json({
      ok: true,
      items: (data ?? []).map((u: any) => ({ userId: u.id, name: u.first_name ?? "Без имени", nick: u.nick ?? null, note: u.badge_note ?? "", at: u.badge_at })),
    });
  }

  if (a === "set_badge") {
    if (!isOwner) return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    const userId = String(body.userId ?? "");
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 });
    const on = !!body.on;
    const note = String(body.note ?? "").trim().slice(0, 200);
    await supabaseAdmin
      .from("users")
      .update(on ? { verified_badge: true, badge_note: note || null, badge_at: new Date().toISOString() } : { verified_badge: false, badge_note: null, badge_at: null })
      .eq("id", userId);
    await logAction(uid, on ? "badge_grant" : "badge_revoke", userId, { note });
    if (on) await notify(userId, "🌟 Вам выдана золотая галочка VETOKS" + (note ? `: ${note}` : ""), "/profile", "other");
    return NextResponse.json({ ok: true });
  }

  if (a === "amb_info") {
    const { data } = await supabaseAdmin
      .from("participants")
      .select("id, display_name, ambassador_bonus, users(nick)")
      .eq("is_ambassador", true)
      .limit(300);
    return NextResponse.json({
      ok: true,
      def: await ambassadorDefault(),
      share: await ambassadorShareValue(),
      items: (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.display_name,
        nick: (Array.isArray(p.users) ? p.users[0]?.nick : p.users?.nick) ?? null,
        bonus: p.ambassador_bonus ?? null,
      })),
    });
  }

  if (a === "amb_default") {
    if (!isOwner) return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    const v = Math.min(100, Math.max(0, Number(body.value) || 0));
    await supabaseAdmin.from("platform_settings").upsert({ key: AMB_DEFAULT_KEY, value: String(v) });
    await logAction(uid, "ambassador_default", null, { value: v });
    return NextResponse.json({ ok: true, def: v });
  }

  if (a === "amb_share") {
    if (!isOwner) return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    const v = Math.min(100, Math.max(0, Number(body.value) || 0));
    await supabaseAdmin.from("platform_settings").upsert({ key: AMB_SHARE_KEY, value: String(v) });
    await logAction(uid, "ambassador_share", null, { value: v });
    return NextResponse.json({ ok: true, share: v });
  }

  // Назначить или снять «амбассадора шоу». Галочка выдаётся автоматически.
  if (a === "set_ambassador") {
    if (!isOwner) return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    const pid = String(body.participantId ?? "");
    if (!pid) return NextResponse.json({ ok: false }, { status: 400 });
    const { data: part } = await supabaseAdmin.from("participants").select("user_id").eq("id", pid).maybeSingle();
    if (!part?.user_id) return NextResponse.json({ ok: false, error: "no_participant" }, { status: 404 });
    const on = !!body.on;
    const raw = body.bonus;
    const bonus = raw === null || raw === undefined || raw === "" ? null : Math.min(100, Math.max(0, Number(raw) || 0));
    await supabaseAdmin
      .from("participants")
      .update(on ? { is_ambassador: true, ambassador_bonus: bonus, ambassador_scope: "show" } : { is_ambassador: false, ambassador_bonus: null })
      .eq("id", pid);
    if (on) {
      const { data: u } = await supabaseAdmin.from("users").select("verified_badge").eq("id", part.user_id).maybeSingle();
      if (!u?.verified_badge) {
        await supabaseAdmin
          .from("users")
          .update({ verified_badge: true, badge_note: "Амбассадор шоу", badge_at: new Date().toISOString() })
          .eq("id", part.user_id);
        await notify(part.user_id as string, "🌟 Вы — амбассадор шоу VETOKS! Вам выдана золотая галочка и повышенный процент выплат.", "/profile", "other");
      }
    }
    await logAction(uid, on ? "ambassador_on" : "ambassador_off", part.user_id as string, { participant: pid, bonus });
    return NextResponse.json({ ok: true });
  }

  if (a === "set_status") {
    const pid = String(body.participantId ?? "");
    const contest = String(body.contest ?? "miss");
    const stage = String(body.stage ?? "selection");
    const crown = String(body.crown ?? "");
    if (!pid || !CONTESTS[contest] || !STAGE_OPTIONS.some((s) => s.key === stage) || !CROWNS.includes(crown))
      return NextResponse.json({ ok: false, error: "bad_value" }, { status: 400 });
    if (crown && !isOwner) return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    await supabaseAdmin.from("participants").update({ contest, stage_key: stage, crown: crown || null }).eq("id", pid);
    await logAction(uid, "participant_status", null, { participant: pid, contest, stage, crown });
    return NextResponse.json({ ok: true });
  }

  if (a === "bulk_stage") {
    if (!isOwner) return NextResponse.json({ ok: false, error: "owner_only" }, { status: 403 });
    const stage = String(body.stage ?? "");
    if (!STAGE_OPTIONS.some((s) => s.key === stage)) return NextResponse.json({ ok: false, error: "bad_value" }, { status: 400 });
    let q = supabaseAdmin.from("participants").update({ stage_key: stage }).eq("is_eliminated", false).is("crown", null);
    if (body.contest && CONTESTS[String(body.contest)]) q = q.eq("contest", String(body.contest));
    // Этап меняется только у участниц выбранной страны CRM.
    if (body.countryId) q = q.in("region_id", await regionIdsOfCountry(String(body.countryId)));
    const { data } = await q.select("id");
    await logAction(uid, "participant_bulk_stage", null, { stage, contest: body.contest ?? null, count: (data ?? []).length });
    return NextResponse.json({ ok: true, count: (data ?? []).length });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
