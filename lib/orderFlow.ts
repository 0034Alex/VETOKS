import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/shopServer";
import { botForUser } from "@/lib/countryBot";
import { loadProduct, sizeStockOf, currencyOfCountry } from "@/lib/businessServer";

// Комиссия платформы: считается и записывается в заказ, но пока нигде не списывается и не показывается.
export const COMMISSION_PCT = 8; // всего, % от суммы заказа, пришедшего из видео участницы
export const COMMISSION_PLATFORM_SHARE = 50; // какая часть комиссии остаётся платформе, %; остальное участнице
export const CREDIT_LIMIT = 12500; // «лимит доверия» магазина, пока не используется

export const NEW_ORDER_COLS = ", items, ship_name, ship_method, ship_city, ship_point, pay_text, invoice_at, paid_claim_at, paid_ok_at, tracking, disputed_at, returned_at, return_reason";

// Пока SQL этапа 1 не выполнен, новый порядок заказов отключён (старые заказы и страницы работают).
let ready = false;
export async function stage1Ready(): Promise<boolean> {
  if (ready) return true;
  const a = await supabaseAdmin.from("business_orders").select("items, ship_name, commission_total, returned_at").limit(1);
  const b = await supabaseAdmin.from("business_profiles").select("pay_text, manager_tg_id").limit(1);
  const c = await supabaseAdmin.from("business_order_log").select("id").limit(1);
  ready = !a.error && !b.error && !c.error;
  return ready;
}

export const METHODS: Record<string, string> = { np: "Новая Почта", up: "Укрпочта", courier: "Курьер", pickup: "Самовывоз" };
export const shortId = (id: string) => String(id).replace(/-/g, "").slice(0, 6).toUpperCase();
const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const money = (n: number | string, cur: string) => {
  const v = Math.round(Number(n) * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${cur}`;
};

export async function tgSend(token: string, chat: string, text: string, markup?: object): Promise<boolean> {
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, ...(markup ? { reply_markup: markup } : {}) }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function orderText(o: any, shopName: string, cur: string): string {
  const head = o.kind === "book" ? "📅 Запрос на бронь" : "🛍 Заказ";
  const lines: string[] = [`${head} №${shortId(o.id)} · ${shopName}`];
  if (Array.isArray(o.items) && o.items.length) {
    for (const i of o.items) lines.push(`• ${i.name}${i.size ? ` (${i.size})` : ""} ×${i.qty} — ${money(i.line_total, cur)}`);
  } else {
    lines.push(`• ${o.product_name}${o.size ? ` (${o.size})` : ""}${Number(o.qty) > 1 ? ` ×${o.qty}` : ""}`);
  }
  if (o.kind === "buy") lines.push(`Итого: ${money(o.total, cur)}`);
  if (o.when_text) lines.push(`Когда: ${o.when_text}`);
  const who = [o.ship_name, o.phone].filter(Boolean).join(", ");
  if (who) lines.push(`Получатель: ${who}`);
  if (o.ship_method) lines.push(`Доставка: ${[METHODS[o.ship_method] ?? o.ship_method, o.ship_city, o.ship_point].filter(Boolean).join(", ")}`);
  if (o.note) lines.push(`Комментарий: ${o.note}`);
  return lines.join("\n");
}

// Кнопки менеджера в Telegram под текущий статус заказа.
export function orderKeyboard(o: any): object | undefined {
  const b = (t: string, c: string) => ({ text: t, callback_data: `bo_${o.id}_${c}` });
  if (o.kind === "book") return o.status === "new" ? { inline_keyboard: [[b("✅ Подтвердить", "ok"), b("❌ Отказ", "no")]] } : undefined;
  if (o.kind !== "buy") return undefined;
  if (o.status === "new") return { inline_keyboard: [[b("✅ Одобрить и выставить счёт", "ok")], [b("❌ Отказ", "no")]] };
  if (o.status === "confirmed" && o.paid_claim_at) return { inline_keyboard: [[b("💰 Деньги получил", "pd"), b("⚠️ Не пришли", "np")]] };
  if (o.status === "paid") return { inline_keyboard: [[b("📦 Отправлено (ТТН)", "sh")]] };
  return undefined;
}

export async function logAct(orderId: string, businessId: string, actor: string, actorName: string, action: string) {
  try {
    await supabaseAdmin.from("business_order_log").insert({ order_id: orderId, business_id: businessId, actor, actor_name: actorName, action });
  } catch {
    /* учёт не должен ломать заказ */
  }
}

// Системная строка в чате заказа (рисуется по центру).
async function sysMsg(orderId: string, senderId: string, text: string) {
  const row = { order_id: orderId, sender_id: senderId, body: "§ " + text };
  const r = await supabaseAdmin.from("business_order_messages").insert({ ...row, channel: "main" });
  if (r.error) await supabaseAdmin.from("business_order_messages").insert(row);
}

// Уведомить магазин: владельцу в приложение и (если есть) менеджеру в Telegram с кнопками.
export async function notifyShop(bp: { id: string; user_id: string; name?: string }, text: string, link: string, order?: any) {
  await notify(bp.user_id, text, link, "other");
  try {
    const { data } = await supabaseAdmin.from("business_profiles").select("manager_tg_id, name, country_id").eq("id", bp.id).maybeSingle();
    const chat = (data as any)?.manager_tg_id;
    if (!chat) return;
    const token = (await botForUser(bp.user_id)).token;
    if (!token) return;
    const cur = await currencyOfCountry((data as any)?.country_id);
    const body = order ? `${text}\n\n${orderText(order, (data as any)?.name ?? "", cur)}` : text;
    await tgSend(token, String(chat), body, order ? orderKeyboard(order) : undefined);
  } catch {
    /* Telegram не обязателен */
  }
}

export async function restoreStock(oo: any) {
  const lines: { product_id: string; size: string; qty: number }[] =
    Array.isArray(oo.items) && oo.items.length ? oo.items : oo.product_id ? [{ product_id: oo.product_id, size: oo.size ?? "", qty: oo.qty }] : [];
  for (const ln of lines) {
    const pr: any = await loadProduct(String(ln.product_id), String(oo.business_id));
    if (!pr) continue;
    const qty = Number(ln.qty) || 0;
    const pss = sizeStockOf(pr);
    if (pss && ln.size && ln.size in pss) {
      const next: Record<string, number> = { ...pss, [String(ln.size)]: pss[String(ln.size)] + qty };
      const sum = Object.values(next).reduce((x: number, y: number) => x + y, 0);
      await supabaseAdmin.from("business_products").update({ size_stock: next, stock: sum }).eq("id", ln.product_id);
    } else if (pr.stock != null) {
      await supabaseAdmin.from("business_products").update({ stock: Number(pr.stock) + qty }).eq("id", ln.product_id);
    }
  }
}

export type Actor = { role: "owner" | "manager" | "buyer"; name: string };

// Все действия над заказом: из приложения (владелец, покупатель) и из Telegram (менеджер).
export async function applyAct(
  oid: string,
  act: string,
  actor: Actor,
  extra: { pay_text?: string; tracking?: string; reason?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const { data: o0 } = await supabaseAdmin.from("business_orders").select("*").eq("id", oid).maybeSingle();
  if (!o0) return { ok: false, error: "not_found" };
  const o: any = o0;
  if (o.kind === "gift") return { ok: false, error: "bad_kind" };
  const { data: bp0 } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, country_id, pay_text").eq("id", o.business_id).maybeSingle();
  const bp: any = bp0;
  if (!bp) return { ok: false, error: "not_found" };
  const cur = await currencyOfCountry(bp.country_id);
  const shop = actor.role !== "buyer";
  const st = String(o.status);
  const now = new Date().toISOString();
  const nm = String(o.product_name);
  const upd = async (patch: Record<string, any>) => {
    await supabaseAdmin.from("business_orders").update({ ...patch, updated_at: now }).eq("id", oid);
  };
  const toBuyer = (t: string) => notify(o.buyer_id, t, `/my-orders?o=${oid}`, "other");
  const link = `/business?tab=orders&o=${oid}`;
  const log = (action: string) => logAct(oid, bp.id, actor.role, actor.name, action);
  const sayShop = (t: string) => sysMsg(oid, bp.user_id, t);
  const sayBuyer = (t: string) => sysMsg(oid, o.buyer_id, t);
  const no = (error = "forbidden") => ({ ok: false, error });
  const isBuy = o.kind === "buy";

  if (act === "approve") {
    if (!shop || st !== "new") return no();
    if (isBuy) {
      const pay = s(extra.pay_text, 600) || s(bp.pay_text, 600);
      if (!pay) return no("need_requisites");
      await upd({ status: "confirmed", pay_text: pay, invoice_at: now });
      await log("approve");
      await sayShop(`Счёт выставлен: ${money(o.total, cur)}.\nОплатите по реквизитам:\n${pay}\nПосле оплаты нажмите «Я оплатил».`);
      await toBuyer(`💳 «${bp.name}» выставил счёт по заказу «${nm}». Откройте заказ, чтобы оплатить.`);
    } else {
      await upd({ status: "confirmed" });
      await log("approve");
      await sayShop("Магазин подтвердил бронь.");
      await toBuyer(`Бронь «${nm}» подтверждена магазином.`);
    }
    return { ok: true };
  }

  if (act === "decline") {
    if (!shop || st !== "new") return no();
    await upd({ status: "cancelled" });
    await restoreStock(o);
    await log("decline");
    await sayShop("Магазин не смог принять заказ.");
    await toBuyer(`Магазин не смог принять «${nm}». Товары вернулись в наличие.`);
    return { ok: true };
  }

  if (act === "claim") {
    if (actor.role !== "buyer" || !isBuy || st !== "confirmed" || o.paid_claim_at) return no();
    await upd({ paid_claim_at: now });
    await log("claim");
    await sayBuyer("Покупатель сообщает, что оплатил. Магазин, подтвердите получение денег.");
    await notifyShop(bp, `💰 Покупатель отметил оплату заказа №${shortId(oid)}. Проверьте поступление.`, link, { ...o, paid_claim_at: now });
    return { ok: true };
  }

  if (act === "paid") {
    if (!shop || !isBuy || st !== "confirmed") return no();
    let pct = 0;
    let total = 0;
    let platform = 0;
    let part = 0;
    if (o.source_participant_id) {
      pct = COMMISSION_PCT;
      total = Math.round(Number(o.total) * pct) / 100;
      platform = Math.round(total * COMMISSION_PLATFORM_SHARE) / 100;
      part = Math.round((total - platform) * 100) / 100;
    }
    await upd({ status: "paid", paid_ok_at: now, disputed_at: null, commission_pct: pct, commission_total: total, commission_platform: platform, commission_participant: part });
    await log("paid");
    await sayShop("Оплата подтверждена. Заказ собирается.");
    await toBuyer(`✅ Магазин подтвердил оплату заказа «${nm}». Заказ собирается.`);
    return { ok: true };
  }

  if (act === "nopaid") {
    if (!shop || !isBuy || st !== "confirmed") return no();
    await upd({ disputed_at: now, paid_claim_at: null });
    await log("nopaid");
    await sayShop("Магазин не видит поступления денег. Проверьте реквизиты и пришлите чек в этот чат, затем снова нажмите «Я оплатил».");
    await toBuyer(`⚠️ Магазин не видит оплату по заказу «${nm}». Пришлите чек в чат заказа.`);
    return { ok: true };
  }

  if (act === "ship") {
    if (!shop || !isBuy || st !== "paid") return no();
    const tr = s(extra.tracking, 60);
    await upd({ status: "shipped", tracking: tr || null });
    await log("ship");
    await sayShop(`Заказ отправлен.${tr ? ` ТТН: ${tr}` : ""}`);
    await toBuyer(`📦 Заказ «${nm}» отправлен.${tr ? ` ТТН: ${tr}` : ""}`);
    return { ok: true };
  }

  if (act === "got" || act === "finish") {
    if (act === "got" ? actor.role !== "buyer" : !shop) return no();
    if (!isBuy || st !== "shipped") return no();
    await upd({ status: "done" });
    await log(act === "got" ? "got" : "finish");
    await (act === "got" ? sayBuyer("Покупатель подтвердил получение. Спасибо!") : sayShop("Заказ выполнен."));
    if (act === "got") await notifyShop(bp, `Покупатель получил заказ №${shortId(oid)}.`, link);
    else await toBuyer(`Заказ «${nm}» выполнен.`);
    return { ok: true };
  }

  if (act === "cancel") {
    const okState = shop ? ["new", "confirmed", "paid"].includes(st) : ["new", "confirmed"].includes(st);
    if (!okState) return no();
    await upd({ status: "cancelled" });
    await restoreStock(o);
    await log("cancel");
    const t = shop ? "Магазин отменил заказ. Если вы уже платили, магазин вернёт деньги." : "Покупатель отменил заказ.";
    await (shop ? sayShop(t) : sayBuyer(t));
    if (shop) await toBuyer(`Заказ «${nm}» отменён магазином.`);
    else await notifyShop(bp, `Покупатель отменил заказ №${shortId(oid)}.`, link);
    return { ok: true };
  }

  if (act === "return_req") {
    if (actor.role !== "buyer" || !isBuy || st !== "done" || o.returned_at) return no();
    const why = s(extra.reason, 200) || "не указана";
    await log("return_req");
    await sayBuyer(`Покупатель запросил возврат. Причина: ${why}`);
    await notifyShop(bp, `↩️ Запрос на возврат по заказу №${shortId(oid)}. Причина: ${why}`, link);
    return { ok: true };
  }

  if (act === "return_ok") {
    if (!shop || !isBuy || st !== "done" || o.returned_at) return no();
    await upd({ returned_at: now, return_reason: s(extra.reason, 200) || null });
    await restoreStock(o);
    await log("return_ok");
    await sayShop("Возврат оформлен. Деньги вернутся покупателю по договорённости в чате.");
    await toBuyer(`Возврат по заказу «${nm}» оформлен магазином.`);
    return { ok: true };
  }

  return no("bad_action");
}
