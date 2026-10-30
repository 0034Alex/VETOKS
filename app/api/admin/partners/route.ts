import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { notify } from "@/lib/shopServer";
import { currencyOfUser } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

const STAGES = ["lead", "talks", "agreed", "paid", "active", "done", "lost"];

async function recount(sponsorId: string) {
  const { data } = await supabaseAdmin.from("sponsor_payments").select("amount").eq("sponsor_id", sponsorId);
  const total = (data ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  await supabaseAdmin.from("sponsors").update({ amount: total }).eq("id", sponsorId);
}

export async function POST(req: Request) {
  const uid = await requireStaff(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const a = body.action;

  if (a === "list") {
    const cid = body.countryId ? String(body.countryId) : "";
    let sq = supabaseAdmin
      .from("sponsors")
      .select("id, name, amount, status, package_type, user_id, contact_info, stage, notes, follow_up_at, created_at, referrer_participant_id, referral_percent, referral_amount, referral_paid_at, country_id, region_id")
      .order("created_at", { ascending: false });
    if (cid) sq = sq.or(`country_id.is.null,country_id.eq.${cid}`);
    const { data: rows } = await sq;
    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: pays } = ids.length
      ? await supabaseAdmin
          .from("sponsor_payments")
          .select("id, sponsor_id, amount, paid_at, note")
          .in("sponsor_id", ids)
          .order("paid_at", { ascending: false })
      : { data: [] as any[] };
    const refIds = Array.from(new Set((rows ?? []).map((r: any) => r.referrer_participant_id).filter(Boolean)));
    const refNames: Record<string, string> = {};
    if (refIds.length) {
      const { data: ps } = await supabaseAdmin.from("participants").select("id, display_name").in("id", refIds);
      (ps ?? []).forEach((p: any) => (refNames[p.id] = p.display_name));
    }
    let rgq = supabaseAdmin.from("regions").select("id, name").order("name");
    if (cid) rgq = rgq.eq("country_id", cid);
    const { data: regionList } = await rgq;
    return NextResponse.json({ ok: true, rows: rows ?? [], payments: pays ?? [], refNames, regions: regionList ?? [] });
  }

  if (a === "create") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false }, { status: 400 });
    await supabaseAdmin.from("sponsors").insert({
      name,
      package_type: String(body.packageType ?? "").trim() || null,
      status: "active",
      stage: "lead",
      country_id: body.countryId ? String(body.countryId) : null,
    });
    await logAction(uid, "partner_create", null, { name });
    return NextResponse.json({ ok: true });
  }

  if (a === "find_participant") {
    const qv = String(body.query ?? "").trim();
    if (qv.length < 2) return NextResponse.json({ ok: true, items: [] });
    const { data } = await supabaseAdmin
      .from("participants")
      .select("id, display_name, regions(name)")
      .ilike("display_name", `%${qv}%`)
      .limit(8);
    return NextResponse.json({ ok: true, items: data ?? [] });
  }

  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  // Область рекламодателя: по ней он видит рекламные места в своём кабинете.
  if (a === "set_region") {
    await supabaseAdmin.from("sponsors").update({ region_id: body.regionId ? String(body.regionId) : null }).eq("id", id);
    await logAction(uid, "partner_region", null, { sponsor: id, region: body.regionId ?? null });
    return NextResponse.json({ ok: true });
  }

  // Участница, которая привела рекламодателя, и процент бонуса.
  if (a === "set_referrer") {
    const { data: cur } = await supabaseAdmin.from("sponsors").select("referral_paid_at").eq("id", id).maybeSingle();
    if (cur?.referral_paid_at) return NextResponse.json({ ok: false, error: "already_paid" }, { status: 400 });
    let pct = Math.min(100, Math.max(0, Number(body.percent) || 0));
    if (!(body.percent !== undefined && body.percent !== null && body.percent !== "") && body.participantId) {
      // процент не вписан: берём общий из CRM «Рефералы» (если включён)
      const { getRefSettings } = await import("@/lib/referral");
      const { data: sc } = await supabaseAdmin.from("sponsors").select("country_id").eq("id", id).maybeSingle();
      const gs = await getRefSettings(((sc as any)?.country_id as string | null) ?? null);
      pct = gs.advOn ? gs.advPercent : 0;
    }
    await supabaseAdmin
      .from("sponsors")
      .update({ referrer_participant_id: body.participantId ? String(body.participantId) : null, referral_percent: pct })
      .eq("id", id);
    await logAction(uid, "partner_referrer", null, { sponsor: id, participant: body.participantId ?? null, percent: pct });
    return NextResponse.json({ ok: true });
  }

  // Зачислить бонус один раз. Только финансовый админ или владелец.
  if (a === "pay_referrer") {
    const { data: me } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
    if (!me || !["finance_admin", "super_admin"].includes(me.role as string)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const { data: sp } = await supabaseAdmin
      .from("sponsors")
      .select("id, name, amount, referrer_participant_id, referral_percent, referral_paid_at")
      .eq("id", id)
      .maybeSingle();
    if (!sp?.referrer_participant_id || !(Number(sp.referral_percent) > 0)) {
      return NextResponse.json({ ok: false, error: "no_referrer" }, { status: 400 });
    }
    if (sp.referral_paid_at) return NextResponse.json({ ok: false, error: "already_paid" }, { status: 400 });
    // Бонус считается только с ПЕРВОГО платежа этого партнёра; докупки и повторные оплаты пригласившей ничего не дают.
    const { data: firstPay } = await supabaseAdmin
      .from("sponsor_payments")
      .select("amount")
      .eq("sponsor_id", id)
      .order("paid_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const total = Number((firstPay as any)?.amount) || 0;
    // Если этот рекламодатель уже принёс бонус автоматически (оплата с баланса), второй раз не платим.
    const { data: spUser } = await supabaseAdmin.from("sponsors").select("user_id").eq("id", id).maybeSingle();
    if ((spUser as any)?.user_id) {
      const { data: au } = await supabaseAdmin.from("users").select("adv_bonus_paid_at").eq("id", (spUser as any).user_id).maybeSingle();
      if ((au as any)?.adv_bonus_paid_at) return NextResponse.json({ ok: false, error: "already_paid" }, { status: 400 });
    }
    const effPct = Math.min(100, Number(sp.referral_percent));
    const bonus = Math.round(((total * effPct) / 100) * 100) / 100;
    if (!(bonus > 0)) return NextResponse.json({ ok: false, error: "no_payments" }, { status: 400 });

    // Занимаем «один раз» прежде чем платить — повторный клик не начислит второй раз.
    const { data: claimed } = await supabaseAdmin
      .from("sponsors")
      .update({ referral_paid_at: new Date().toISOString(), referral_amount: bonus })
      .eq("id", id)
      .is("referral_paid_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: false, error: "already_paid" }, { status: 400 });

    if ((spUser as any)?.user_id) {
      await supabaseAdmin.from("users").update({ adv_bonus_paid_at: new Date().toISOString() }).eq("id", (spUser as any).user_id);
    }
    const { data: part } = await supabaseAdmin
      .from("participants")
      .select("user_id")
      .eq("id", sp.referrer_participant_id)
      .maybeSingle();
    if (!part?.user_id) {
      await supabaseAdmin.from("sponsors").update({ referral_paid_at: null, referral_amount: null }).eq("id", id);
      return NextResponse.json({ ok: false, error: "no_participant" }, { status: 400 });
    }
    const { error } = await supabaseAdmin.rpc("vt_credit", {
      p_user: part.user_id,
      p_amount: bonus,
      p_type: "advertiser_bonus",
      p_meta: { sponsor: sp.id, sponsor_name: sp.name, percent: effPct },
    });
    if (error) {
      await supabaseAdmin.from("sponsors").update({ referral_paid_at: null, referral_amount: null }).eq("id", id);
      return NextResponse.json({ ok: false, error: "credit_failed", detail: error.message }, { status: 500 });
    }
    await notify(part.user_id as string, `💰 Вам начислено ${bonus} Корон — бонус за приведённого рекламодателя`, "/history", "other");
    await logAction(uid, "partner_bonus", part.user_id as string, { sponsor: id, amount: bonus });
    return NextResponse.json({ ok: true, amount: bonus });
  }

  if (a === "update") {
    const patch: Record<string, any> = {};
    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) return NextResponse.json({ ok: false }, { status: 400 });
      patch.stage = body.stage;
    }
    if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 3000);
    if (body.followUpAt !== undefined) patch.follow_up_at = body.followUpAt || null;
    await supabaseAdmin.from("sponsors").update(patch).eq("id", id);
    if (patch.stage) await logAction(uid, "partner_stage", null, { sponsor: id, stage: patch.stage });
    return NextResponse.json({ ok: true });
  }

  if (a === "add_payment") {
    const amount = Number(body.amount);
    if (!isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "amount" }, { status: 400 });
    await supabaseAdmin.from("sponsor_payments").insert({
      sponsor_id: id,
      amount,
      paid_at: body.paidAt || new Date().toISOString().slice(0, 10),
      note: String(body.note ?? "").slice(0, 300) || null,
    });
    await recount(id);
    await logAction(uid, "partner_payment", null, { sponsor: id, amount });
    return NextResponse.json({ ok: true });
  }

  if (a === "delete_payment") {
    await supabaseAdmin.from("sponsor_payments").delete().eq("id", String(body.paymentId ?? ""));
    await recount(id);
    return NextResponse.json({ ok: true });
  }

  if (a === "find_user") {
    const qv = String(body.query ?? "").trim();
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, first_name")
      .eq(qv.includes("@") ? "email" : "phone", qv)
      .maybeSingle();
    return NextResponse.json({ ok: true, user: data ?? null });
  }

  if (a === "link") {
    await supabaseAdmin.from("sponsors").update({ user_id: String(body.userId), status: "approved" }).eq("id", id);
    await logAction(uid, "partner_link", String(body.userId), { sponsor: id });
    return NextResponse.json({ ok: true });
  }

  // Одобрить / отклонить заявку, пришедшую из приложения: человек получает уведомление.
  if (a === "approve" || a === "reject") {
    const { data: sp } = await supabaseAdmin.from("sponsors").select("id, user_id, name").eq("id", id).maybeSingle();
    if (!sp?.user_id) return NextResponse.json({ ok: false, error: "no_user" }, { status: 400 });
    const ok = a === "approve";
    await supabaseAdmin.from("sponsors").update({ status: ok ? "approved" : "rejected" }).eq("id", id);
    await logAction(uid, ok ? "partner_approve" : "partner_reject", String(sp.user_id), { sponsor: id });
    const { notify } = await import("@/lib/shopServer");
    await notify(
      String(sp.user_id),
      ok
        ? "✅ Ваша заявка партнёра одобрена! Откройте «Рекламный кабинет» и выберите места для рекламы."
        : "К сожалению, заявка партнёра пока не одобрена. Если есть вопросы — напишите в поддержку.",
      ok ? "/ad-space" : "/support",
      "other"
    );
    return NextResponse.json({ ok: true });
  }

  if (a === "unlink") {
    await supabaseAdmin.from("sponsors").update({ user_id: null, status: "active" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
