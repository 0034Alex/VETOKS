import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser, notify } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser, countryOfRegion } from "@/lib/countryServer";
import { familyRootId } from "@/lib/familyServer";
import { offerLive, loadProduct, sizeStockOf } from "@/lib/businessServer";

export const dynamic = "force-dynamic";

const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const STATUSES = ["new", "confirmed", "shipped", "done", "cancelled", "paid", "accepted", "received", "declined"];
const BASE_COLS = "id, business_id, buyer_id, kind, product_id, product_name, sku, size, qty, unit_price, discount_percent, total, promo_code, note, when_text, phone, status, created_at";
const GIFT_COLS = ", recipient_participant_id, recipient_user_id, gift_anon, gift_message";

// Подарки отправляем только совершеннолетним: у несовершеннолетних адрес не запрашиваем.
const BLOCK_TEEN_GIFTS = true;

// Если SQL этапа 3 ещё не выполнен, работаем без полей подарка.
let giftCols: boolean | null = null;
async function orderCols(): Promise<string> {
  if (giftCols === null) {
    const r = await supabaseAdmin.from("business_orders").select("recipient_user_id").limit(1);
    giftCols = !r.error;
  }
  return giftCols ? BASE_COLS + GIFT_COLS : BASE_COLS;
}

const TXT: Record<string, string> = { confirmed: "подтверждён", shipped: "отправлен", done: "выполнен", cancelled: "отменён" };

// Заказы и подарки между зрителями и партнёрами. Деньги идут напрямую партнёру, VETOKS в оплате не участвует.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = b.action;
  const COLS = await orderCols();

  // Поиск получателя подарка: любой пользователь VETOKS своей страны (кроме несовершеннолетних и себя).
  if (a === "gift_find") {
    const q = s(b.query, 40);
    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });
    const cid = await countryOfUser(uid);
    const myRoot = await familyRootId(uid);
    const { data: ps } = await supabaseAdmin.from("participants").select("user_id, display_name, photo_url").ilike("display_name", `%${q}%`).limit(25);
    const { data: us0 } = await supabaseAdmin.from("users").select("id").ilike("first_name", `%${q}%`).limit(25);
    const partBy: Record<string, any> = {};
    ((ps as any[]) ?? []).forEach((x) => x.user_id && (partBy[x.user_id] = x));
    const ids = Array.from(new Set([...Object.keys(partBy), ...((us0 as any[]) ?? []).map((x) => x.id)])).filter((x) => x !== uid);
    if (!ids.length) return NextResponse.json({ ok: true, items: [] });
    const { data: us } = await supabaseAdmin.from("users").select("id, first_name, photo_url, age_category, region_id, is_banned, is_business, parent_user_id").in("id", ids);
    const regionCountry: Record<string, string | null> = {};
    const out: any[] = [];
    for (const x of ((us as any[]) ?? [])) {
      if (x.is_banned || x.is_business) continue;
      if (BLOCK_TEEN_GIFTS && x.age_category === "teen") continue;
      if (myRoot && (x.parent_user_id ?? x.id) === myRoot) continue;
      if (cid && x.region_id) {
        if (!(x.region_id in regionCountry)) regionCountry[x.region_id] = await countryOfRegion(x.region_id);
        const c = regionCountry[x.region_id];
        if (c && c !== cid) continue;
      }
      const p = partBy[x.id];
      out.push({ id: x.id, name: p?.display_name || x.first_name || "Без имени", photo_url: p?.photo_url ?? x.photo_url ?? null });
      if (out.length >= 10) break;
    }
    return NextResponse.json({ ok: true, items: out });
  }

  if (a === "create") {
    const rl = await rateLimit(req, "business/order", 20, 3600, uid);
    if (rl) return rl;
    const { data: bp } = await supabaseAdmin
      .from("business_profiles")
      .select("id, user_id, name, country_id, is_active, is_hidden")
      .eq("id", String(b.businessId ?? ""))
      .maybeSingle();
    if (!bp || !(bp as any).is_active || (bp as any).is_hidden) return bad("not_found", 404);
    if ((bp as any).user_id === uid) return bad("own_business");
    if ((bp as any).country_id) {
      const cid = await countryOfUser(uid);
      if (cid && cid !== (bp as any).country_id) return bad("not_found", 404);
    }
    const kind = b.kind === "book" ? "book" : b.kind === "gift" ? "gift" : "buy";
    const phone = s(b.phone, 40);
    if (!phone) return bad("need_phone");
    const qty = Math.min(99, Math.max(1, Math.floor(Number(b.qty) || 1)));

    // Получательница подарка
    let recipientPid: string | null = null;
    let recipientUid: string | null = null;
    if (kind === "gift") {
      if (!giftCols) return bad("gifts_unavailable", 503);
      const rid = String(b.recipientId ?? "");
      const { data: ru } = await supabaseAdmin.from("users").select("id, age_category, is_banned, is_business, parent_user_id").eq("id", rid).maybeSingle();
      if (!ru || (ru as any).is_banned || (ru as any).is_business) return bad("no_recipient", 404);
      recipientUid = String((ru as any).id);
      const myRoot = await familyRootId(uid);
      const herRoot = ((ru as any).parent_user_id as string | null) ?? recipientUid;
      if (myRoot && myRoot === herRoot) return bad("self_gift");
      if (BLOCK_TEEN_GIFTS && (ru as any)?.age_category === "teen") return bad("teen_gift");
      const cid = await countryOfUser(uid);
      const rc = await countryOfUser(recipientUid);
      if (cid && rc && cid !== rc) return bad("no_recipient", 404);
      const { data: pa } = await supabaseAdmin.from("participants").select("id").eq("user_id", recipientUid).maybeSingle();
      recipientPid = pa ? String((pa as any).id) : null;
    }

    let product: any = null;
    let ss: Record<string, number> | null = null;
    const size = s(b.size, 30);
    if (b.productId) {
      product = await loadProduct(String(b.productId), (bp as any).id);
      if (!product || !product.is_active) return bad("no_product", 404);
      ss = sizeStockOf(product);
      if (ss) {
        if (!(size in ss)) return bad("need_size");
        if (ss[size] < qty) return bad("no_stock");
      } else {
        if (product.stock != null && Number(product.stock) < qty) return bad("no_stock");
        const sizes = String(product?.sizes ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        if (sizes.length && !sizes.includes(size)) return bad("need_size");
      }
    } else if (kind !== "book") {
      return bad("no_product");
    }

    let pct = 0;
    let usedCode: string | null = null;
    let offerId: string | null = null;
    const code = s(b.promo, 30).toUpperCase().replace(/\s+/g, "");
    if (code) {
      const { data: of } = await supabaseAdmin
        .from("business_offers")
        .select("id, promo_code, discount_percent, valid_until, usage_limit, used_count, is_active")
        .eq("business_id", (bp as any).id)
        .eq("promo_code", code)
        .maybeSingle();
      if (!of || !offerLive(of)) return bad("promo_invalid");
      pct = Math.min(100, Math.max(0, Number((of as any).discount_percent) || 0));
      usedCode = code;
      offerId = (of as any).id;
    }
    const unit = product ? Number(product.price) : 0;
    const total = Math.round(unit * qty * (1 - pct / 100) * 100) / 100;

    const row: Record<string, any> = {
      business_id: (bp as any).id,
      buyer_id: uid,
      kind,
      product_id: product?.id ?? null,
      product_name: product ? product.name : s(b.service, 120) || "Бронь",
      sku: product?.sku ?? null,
      size: size || null,
      qty,
      unit_price: unit,
      discount_percent: pct,
      total,
      promo_code: usedCode,
      note: s(b.note, 500) || null,
      when_text: s(b.whenText, 80) || null,
      phone,
    };
    if (kind === "gift") {
      row.recipient_participant_id = recipientPid;
      row.recipient_user_id = recipientUid;
      row.gift_anon = !!b.anon;
      row.gift_message = s(b.message, 300) || null;
    }
    const { data: created, error } = await supabaseAdmin.from("business_orders").insert(row).select("id").maybeSingle();
    if (error || !created) return bad("failed", 500);

    if (product && ss) {
      const next = { ...ss, [size]: Math.max(0, ss[size] - qty) };
      await supabaseAdmin.from("business_products").update({ size_stock: next, stock: Object.values(next).reduce((x, y) => x + y, 0) }).eq("id", product.id);
    } else if (product && product.stock != null) {
      await supabaseAdmin.from("business_products").update({ stock: Math.max(0, Number(product.stock) - qty) }).eq("id", product.id);
    }
    if (offerId) {
      const { data: cur } = await supabaseAdmin.from("business_offers").select("used_count").eq("id", offerId).maybeSingle();
      await supabaseAdmin.from("business_offers").update({ used_count: Number((cur as any)?.used_count ?? 0) + 1 }).eq("id", offerId);
    }
    await notify(
      (bp as any).user_id,
      kind === "gift" ? `🎁 Новый подарок: ${product?.name}. Ждите оплату от дарителя и отметьте её в «Заказах».` : `🛍 Новый ${kind === "book" ? "запрос на бронь" : "заказ"}: ${product ? product.name : "бронь"}. Откройте «Заказы».`,
      `/business?tab=orders&o=${(created as any).id}`,
      "other"
    );
    return NextResponse.json({ ok: true, id: (created as any).id, total });
  }

  if (a === "my") {
    const { data } = await supabaseAdmin.from("business_orders").select(COLS).eq("buyer_id", uid).order("created_at", { ascending: false }).limit(100);
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.business_id)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: bs } = await supabaseAdmin.from("business_profiles").select("id, name").in("id", ids);
      ((bs as any[]) ?? []).forEach((x) => (names[x.id] = x.name));
    }
    const ruids = Array.from(new Set(rows.map((r) => r.recipient_user_id).filter(Boolean)));
    const rnames: Record<string, string> = {};
    if (ruids.length) {
      const { data: us } = await supabaseAdmin.from("users").select("id, first_name").in("id", ruids);
      ((us as any[]) ?? []).forEach((x) => (rnames[String(x.id)] = x.first_name || ""));
      const { data: ps } = await supabaseAdmin.from("participants").select("user_id, display_name").in("user_id", ruids);
      ((ps as any[]) ?? []).forEach((x) => x.display_name && (rnames[String(x.user_id)] = x.display_name));
    }
    return NextResponse.json({ ok: true, items: rows.map((r) => ({ ...r, business_name: names[r.business_id] ?? "", recipient_name: rnames[String(r.recipient_user_id)] ?? "" })) });
  }

  // Подарки, которые подарили мне. Пока даритель не оплатил, участница ничего не видит.
  if (a === "incoming") {
    if (!giftCols) return NextResponse.json({ ok: true, items: [] });
    const { data } = await supabaseAdmin
      .from("business_orders")
      .select(COLS)
      .eq("recipient_user_id", uid)
      .in("status", ["paid", "accepted", "shipped", "received", "declined"])
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.business_id)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: bs } = await supabaseAdmin.from("business_profiles").select("id, name").in("id", ids);
      ((bs as any[]) ?? []).forEach((x) => (names[x.id] = x.name));
    }
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({ id: r.id, kind: "gift", status: r.status, product_name: r.product_name, created_at: r.created_at, total: 0, business_name: names[r.business_id] ?? "" })),
    });
  }

  if (a === "biz") {
    const { data: bp } = await supabaseAdmin.from("business_profiles").select("id").eq("user_id", uid).maybeSingle();
    if (!bp) return bad("no_business", 404);
    const { data } = await supabaseAdmin.from("business_orders").select(COLS).eq("business_id", (bp as any).id).order("created_at", { ascending: false }).limit(200);
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.buyer_id)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: us } = await supabaseAdmin.from("users").select("id, first_name").in("id", ids);
      ((us as any[]) ?? []).forEach((x) => (names[x.id] = x.first_name || "Покупатель"));
    }
    return NextResponse.json({ ok: true, items: rows.map((r) => ({ ...r, buyer_name: names[r.buyer_id] ?? "Покупатель" })) });
  }

  // Дальше действия над одним заказом: доступ покупателю, владельцу страницы и получательнице подарка.
  const oid = String(b.id ?? "");
  if (!oid) return bad("no_id");
  const { data: o } = await supabaseAdmin.from("business_orders").select(COLS).eq("id", oid).maybeSingle();
  if (!o) return bad("not_found", 404);
  const oo = o as any;
  const { data: bp2 } = await supabaseAdmin.from("business_profiles").select("id, user_id, name").eq("id", oo.business_id).maybeSingle();
  const isBuyer = oo.buyer_id === uid;
  const isOwner = !!bp2 && (bp2 as any).user_id === uid;
  const isRecipient = oo.kind === "gift" && oo.recipient_user_id === uid && oo.status !== "new" && oo.status !== "cancelled";
  if (!isBuyer && !isOwner && !isRecipient) return bad("forbidden", 403);
  const ownerId = (bp2 as any)?.user_id as string | undefined;
  const gift = oo.kind === "gift";
  const role = isOwner ? "owner" : isBuyer ? "buyer" : "recipient";
  const giverName = async () => {
    if (oo.gift_anon) return "тайного поклонника";
    const { data: bu } = await supabaseAdmin.from("users").select("first_name").eq("id", oo.buyer_id).maybeSingle();
    return (bu as any)?.first_name || "зрителя";
  };

  if (a === "get") {
    let msgsQ = supabaseAdmin.from("business_order_messages").select("id, sender_id, body, created_at, channel").eq("order_id", oid).order("created_at", { ascending: true }).limit(400);
    if (role === "buyer") msgsQ = msgsQ.eq("channel", "main");
    if (role === "recipient") msgsQ = msgsQ.eq("channel", "recipient");
    const { data: msgs } = await msgsQ;
    const { data: bu } = await supabaseAdmin.from("users").select("first_name").eq("id", oo.buyer_id).maybeSingle();
    let recipientName = "";
    if (oo.recipient_user_id) {
      const { data: rp } = await supabaseAdmin.from("participants").select("display_name").eq("user_id", oo.recipient_user_id).maybeSingle();
      recipientName = (rp as any)?.display_name ?? "";
      if (!recipientName) {
        const { data: ru2 } = await supabaseAdmin.from("users").select("first_name").eq("id", oo.recipient_user_id).maybeSingle();
        recipientName = (ru2 as any)?.first_name ?? "";
      }
    }
    const base = { ...oo, business_name: (bp2 as any)?.name ?? "", buyer_name: (bu as any)?.first_name ?? "Покупатель", recipient_name: recipientName };
    // Получательнице не показываем телефон и имя анонимного дарителя.
    const order =
      role === "recipient"
        ? { ...base, phone: null, buyer_name: oo.gift_anon ? "Тайный поклонник" : base.buyer_name, note: null, unit_price: 0, total: 0, promo_code: null }
        : role === "buyer" && gift
        ? { ...base, recipient_user_id: null }
        : base;
    return NextResponse.json({ ok: true, order, messages: msgs ?? [], me: uid, role });
  }

  if (a === "send") {
    const rl = await rateLimit(req, "business/order-msg", 60, 600, uid);
    if (rl) return rl;
    const body = s(b.body, 1000);
    if (!body) return bad("empty");
    let channel = "main";
    if (gift && role === "recipient") channel = "recipient";
    if (gift && role === "owner" && b.channel === "recipient") channel = "recipient";
    // Чат магазина с участницей открывается после того, как она приняла подарок.
    if (channel === "recipient" && !["accepted", "shipped", "received"].includes(oo.status)) return bad("not_accepted", 400);
    if (channel === "main" && role === "recipient") return bad("forbidden", 403);
    const { error } = await supabaseAdmin.from("business_order_messages").insert({ order_id: oid, sender_id: uid, body, ...(giftCols ? { channel } : {}) });
    if (error) return bad("failed", 500);
    let to: string | undefined;
    if (role === "owner") to = channel === "recipient" ? oo.recipient_user_id : oo.buyer_id;
    else to = ownerId;
    const link = role === "owner" ? (channel === "recipient" ? `/my-orders?tab=incoming&o=${oid}` : `/my-orders?o=${oid}`) : `/business?tab=orders&o=${oid}`;
    if (to) await notify(to, `💬 Новое сообщение по ${gift ? "подарку" : "заказу"} «${oo.product_name}»`, link, "other");
    return NextResponse.json({ ok: true });
  }

  if (a === "status") {
    const st = String(b.status ?? "");
    if (!STATUSES.includes(st) || st === "new") return bad("bad_status");
    const cur = oo.status as string;
    if (["done", "cancelled", "received", "declined"].includes(cur)) return bad("closed");

    // Кто какой статус может ставить.
    let allowed = false;
    if (!gift) {
      if (isOwner) allowed = ["confirmed", "shipped", "done", "cancelled"].includes(st);
      else if (isBuyer) allowed = st === "cancelled" && cur === "new";
    } else {
      if (isOwner) allowed = (st === "paid" && cur === "new") || (st === "shipped" && cur === "accepted") || (st === "cancelled" && ["new", "paid", "declined"].includes(cur));
      else if (isRecipient) allowed = ((st === "accepted" || st === "declined") && cur === "paid") || (st === "received" && cur === "shipped");
      else if (isBuyer) allowed = st === "cancelled" && cur === "new";
    }
    if (!allowed) return bad("forbidden", 403);

    await supabaseAdmin.from("business_orders").update({ status: st, updated_at: new Date().toISOString() }).eq("id", oid);
    if (st === "cancelled" && oo.product_id) {
      const pr: any = await loadProduct(String(oo.product_id), String(oo.business_id));
      const pss = pr ? sizeStockOf(pr) : null;
      if (pr && pss && oo.size && oo.size in pss) {
        const next = { ...pss, [oo.size]: pss[oo.size] + Number(oo.qty) };
        await supabaseAdmin.from("business_products").update({ size_stock: next, stock: Object.values(next).reduce((x, y) => x + y, 0) }).eq("id", oo.product_id);
      } else if (pr && pr.stock != null) {
        await supabaseAdmin.from("business_products").update({ stock: Number(pr.stock) + Number(oo.qty) }).eq("id", oo.product_id);
      }
    }

    const nm = oo.product_name;
    if (!gift) {
      const other = isBuyer ? ownerId : oo.buyer_id;
      if (other) await notify(other, `Заказ «${nm}» ${TXT[st] ?? st}`, isBuyer ? `/business?tab=orders&o=${oid}` : `/my-orders?o=${oid}`, "other");
    } else {
      const gl = `/my-orders?o=${oid}`;
      const rl2 = `/my-orders?tab=incoming&o=${oid}`;
      const ol = `/business?tab=orders&o=${oid}`;
      if (st === "paid") {
        await notify(oo.buyer_id, `✅ Магазин получил оплату подарка «${nm}». Теперь подарок ждёт согласия участницы.`, gl, "other");
        if (oo.recipient_user_id) await notify(oo.recipient_user_id, `🎁 Вам подарок от ${await giverName()}: «${nm}». Откройте, чтобы принять.`, rl2, "gifts");
      } else if (st === "accepted") {
        await notify(oo.buyer_id, `Участница приняла ваш подарок «${nm}». Магазин уточняет доставку.`, gl, "other");
        if (ownerId) await notify(ownerId, `Участница приняла подарок «${nm}». Уточните адрес в чате с участницей.`, ol, "other");
      } else if (st === "declined") {
        await notify(oo.buyer_id, `Участница отказалась от подарка «${nm}». Свяжитесь с магазином о возврате оплаты.`, gl, "other");
        if (ownerId) await notify(ownerId, `Участница отказалась от подарка «${nm}». Верните оплату дарителю.`, ol, "other");
      } else if (st === "shipped") {
        await notify(oo.buyer_id, `📦 Подарок «${nm}» отправлен.`, gl, "other");
        if (oo.recipient_user_id) await notify(oo.recipient_user_id, `📦 Подарок «${nm}» уже в пути. Когда получите, нажмите «Получено».`, rl2, "gifts");
      } else if (st === "received") {
        await notify(oo.buyer_id, `💗 Участница получила ваш подарок «${nm}». Спасибо!`, gl, "other");
        if (ownerId) await notify(ownerId, `Участница подтвердила получение подарка «${nm}».`, ol, "other");
      } else if (st === "cancelled") {
        const other = isBuyer ? ownerId : oo.buyer_id;
        if (other) await notify(other, `Подарок «${nm}» отменён.`, isBuyer ? ol : gl, "other");
      }
    }
    return NextResponse.json({ ok: true });
  }

  return bad("bad_action");
}
