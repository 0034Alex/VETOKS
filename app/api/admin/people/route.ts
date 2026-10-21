import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "list") {
    const q = String(body.q ?? "").trim().replace(/[%,()]/g, " ");
    const filter = String(body.filter ?? "all");
    const region = body.regionId ? String(body.regionId) : null;

    let query = supabaseAdmin
      .from("users")
      .select("id, first_name, username, phone, email, is_banned, phone_verified, created_at, last_login_at, region_id, photo_url, role, age_category, regions(name)")
      .order("created_at", { ascending: false })
      .limit(60);
    if (q) {
      query = query.or(
        `first_name.ilike.%${q}%,username.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
      );
    }
    if (region) query = query.eq("region_id", region);
    else if (body.countryId) query = query.in("region_id", await regionIdsOfCountry(String(body.countryId)));
    if (filter === "teen" || filter === "main" || filter === "adult") query = query.eq("age_category", filter);
    if (filter === "nobirth") query = query.is("birth_date", null);
    if (filter === "banned") query = query.eq("is_banned", true);
    if (filter === "unverified") query = query.eq("phone_verified", false);
    if (filter === "new7") query = query.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    const { data } = await query;
    let rows: any[] = data ?? [];

    // Отметка «участница»
    const ids = rows.map((r) => r.id);
    const { data: parts } = ids.length
      ? await supabaseAdmin.from("participants").select("id, user_id, is_eliminated").in("user_id", ids)
      : { data: [] as any[] };
    const pm = new Map((parts ?? []).map((p: any) => [p.user_id, p]));
    rows = rows.map((r) => ({ ...r, participant: pm.get(r.id) ?? null }));
    if (filter === "participants") rows = rows.filter((r) => r.participant);
    return NextResponse.json({ ok: true, rows });
  }

  if (action === "card") {
    const id = String(body.userId ?? "");
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, first_name, username, phone, email, is_banned, phone_verified, phone_verified_at, created_at, last_login_at, role, age_category, birth_date, regions(name)")
      .eq("id", id)
      .maybeSingle();
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", id).maybeSingle();
    const { count: votesCast } = await supabaseAdmin.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", id);
    const { count: giftsSent } = await supabaseAdmin.from("gifts").select("id", { count: "exact", head: true }).eq("sender_id", id);

    const { data: part } = await supabaseAdmin
      .from("participants")
      .select("id, display_name, is_eliminated")
      .eq("user_id", id)
      .maybeSingle();

    const signs: string[] = [];
    let votesReceived = 0;
    let reportsAgainst = 0;
    if (part) {
      const { data: vs } = await supabaseAdmin
        .from("votes")
        .select("voter_id")
        .eq("participant_id", part.id)
        .order("created_at", { ascending: false })
        .limit(500);
      votesReceived = vs?.length ?? 0;
      const voterIds = Array.from(new Set((vs ?? []).map((v: any) => v.voter_id).filter(Boolean)));
      if (voterIds.length >= 5) {
        const { data: voters } = await supabaseAdmin.from("users").select("id, created_at, phone_verified").in("id", voterIds.slice(0, 500));
        const young = (voters ?? []).filter((v: any) => Date.now() - new Date(v.created_at).getTime() < 3 * 86400000).length;
        const unver = (voters ?? []).filter((v: any) => !v.phone_verified).length;
        if (young / voterIds.length > 0.6) signs.push(`Больше 60% голосующих — аккаунты младше 3 дней (${young} из ${voterIds.length})`);
        if (unver / voterIds.length > 0.8) signs.push(`Большинство голосующих без подтверждённого номера (${unver} из ${voterIds.length})`);
        if (voterIds.length < (vs?.length ?? 0) / 4) signs.push("Много голосов от одних и тех же людей");
      }
      const { data: posts } = await supabaseAdmin.from("content_posts").select("id").eq("participant_id", part.id).limit(200);
      const postIds = (posts ?? []).map((p: any) => p.id);
      if (postIds.length) {
        const { count } = await supabaseAdmin.from("content_reports").select("id", { count: "exact", head: true }).in("post_id", postIds);
        reportsAgainst = count ?? 0;
        if (reportsAgainst >= 3) signs.push(`На ролики участницы пожаловались ${reportsAgainst} раз`);
      }
    }

    const { data: log } = await supabaseAdmin
      .from("admin_log")
      .select("action, created_at, meta")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(8);

    return NextResponse.json({
      ok: true,
      user,
      balance: Number(wallet?.balance ?? 0),
      votesCast: votesCast ?? 0,
      giftsSent: giftsSent ?? 0,
      participant: part ?? null,
      votesReceived,
      reportsAgainst,
      signs,
      log: log ?? [],
    });
  }

  if (action === "setpass") {
    // Новый пароль человеку — только владелец.
    const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
    if (me?.role !== "super_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const id = String(body.userId ?? "");
    const password = String(body.password ?? "");
    if (!id || password.length < 8) return NextResponse.json({ ok: false, error: "short" }, { status: 400 });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (error) return NextResponse.json({ ok: false, error: "server", detail: error.message }, { status: 500 });
    await logAction(uid, "set_password", id);
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(id);
    const { data: u } = await supabaseAdmin.from("users").select("phone, phone_verified, email").eq("id", id).maybeSingle();
    return NextResponse.json({ ok: true, loginEmail: u?.email ?? null, authEmail: au?.user?.email ?? null, phone: u?.phone ?? null, phoneVerified: !!u?.phone_verified });
  }

  if (action === "ban") {
    const id = String(body.userId ?? "");
    const ban = !!body.ban;
    await supabaseAdmin.from("users").update({ is_banned: ban }).eq("id", id);
    await logAction(uid, ban ? "ban" : "unban", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "hide") {
    const pid = String(body.participantId ?? "");
    const hide = !!body.hide;
    const { data: p } = await supabaseAdmin.from("participants").select("user_id").eq("id", pid).maybeSingle();
    await supabaseAdmin.from("participants").update({ is_eliminated: hide }).eq("id", pid);
    await logAction(uid, hide ? "hide_from_contest" : "show_in_contest", p?.user_id ?? null, { participant: pid });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
