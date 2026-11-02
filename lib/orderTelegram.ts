import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/shopServer";
import { applyAct, tgSend, shortId, orderKeyboard } from "@/lib/orderFlow";

async function tgApi(token: string, method: string, body: object) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    /* ничего */
  }
}

const who = (from: any): string => (from?.username ? "@" + from.username : String(from?.first_name || "Менеджер"));

// Менеджер нажал Start по ссылке из настроек магазина: привязываем его чат к магазину.
export async function bizBind(token: string, chatId: string, code: string, from: any) {
  const { data } = await supabaseAdmin.from("business_profiles").select("id, user_id, name, manager_tg_name").eq("manager_code", code).maybeSingle();
  const bp: any = data;
  if (!bp) {
    await tgSend(token, chatId, "Ссылка устарела. Попросите владельца магазина выдать новую.");
    return;
  }
  const expected = String(bp.manager_tg_name ?? "").replace(/^@/, "").toLowerCase();
  const uname = String(from?.username ?? "").toLowerCase();
  if (expected && uname !== expected) {
    await tgSend(token, chatId, `Эта ссылка выдана для @${expected}. Откройте её с аккаунта этого менеджера.`);
    return;
  }
  const name = who(from);
  await supabaseAdmin.from("business_profiles").update({ manager_tg_id: chatId, manager_tg_name: name, manager_code: null }).eq("id", bp.id);
  await tgSend(token, chatId, `✅ Готово! Вы менеджер магазина «${bp.name}». Сюда будут приходить новые заказы с кнопками действий.`);
  await notify(bp.user_id, `Менеджер ${name} подключён к магазину.`, "/business?tab=pay", "other");
}

async function authorized(chatId: string, businessId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("business_profiles").select("manager_tg_id").eq("id", businessId).maybeSingle();
  return !!(data as any)?.manager_tg_id && String((data as any).manager_tg_id) === chatId;
}

const ERR_TEXT: Record<string, string> = {
  need_requisites: "Сначала владелец должен указать реквизиты в настройках магазина (вкладка «Оплата»).",
  forbidden: "Это действие сейчас недоступно: статус заказа уже изменился.",
  not_found: "Заказ не найден.",
};

// Нажатие кнопки под заказом.
export async function bizCallback(token: string, cb: any) {
  const m = String(cb?.data ?? "").match(/^bo_([0-9a-f-]{36})_(ok|no|pd|np|sh|ck|dl|fn)$/);
  if (!m) return;
  const oid = m[1];
  const code = m[2];
  const chatId = String(cb.from?.id ?? "");
  const { data: o } = await supabaseAdmin.from("business_orders").select("id, business_id").eq("id", oid).maybeSingle();
  if (!o || !(await authorized(chatId, String((o as any).business_id)))) {
    await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Нет доступа к этому заказу", show_alert: true });
    return;
  }
  if (code === "sh") {
    await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await tgSend(token, chatId, `📦 Заказ №${shortId(oid)}: отправьте номер ТТН ответом на это сообщение (или «-», если без номера).\nID заказа: ${oid}`, { force_reply: true, input_field_placeholder: "ТТН" });
    return;
  }
  const act = code === "ok" ? "approve" : code === "no" ? "decline" : code === "pd" ? "paid" : code === "ck" ? "cook" : code === "dl" ? "ship" : code === "fn" ? "finish" : "nopaid";
  const res = await applyAct(oid, act, { role: "manager", name: who(cb.from) });
  if (!res.ok) {
    await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id, text: ERR_TEXT[res.error ?? ""] ?? "Не получилось. Откройте заказ в приложении.", show_alert: true });
    return;
  }
  await tgApi(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Готово" });
  if (cb.message?.message_id) await tgApi(token, "editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
  const done: Record<string, string> = {
    ok: "✅ Заказ одобрен, покупателю отправлен счёт.",
    no: "❌ Заказ отклонён.",
    pd: "💰 Оплата подтверждена. Когда отправите, нажмите «Отправлено» в новом сообщении.",
    np: "⚠️ Покупателю отправлена просьба прислать чек.",
    ck: "👨‍🍳 Отмечено: готовится.",
    dl: "🚴 Отмечено: передан курьеру или готов к выдаче.",
    fn: "✅ Заказ закрыт.",
  };
  const { data: after } = await supabaseAdmin.from("business_orders").select("*").eq("id", oid).maybeSingle();
  const nextKb = (after as any)?.order_type === "food" ? orderKeyboard(after) : undefined;
  await tgSend(token, chatId, `${done[code]} (№${shortId(oid)})`, nextKb ? nextKb : code === "pd" ? { inline_keyboard: [[{ text: "📦 Отправлено (ТТН)", callback_data: `bo_${oid}_sh` }]] } : undefined);
}

// Менеджер ответил на просьбу прислать ТТН.
export async function bizReply(token: string, message: any): Promise<boolean> {
  const m = String(message?.reply_to_message?.text ?? "").match(/ID заказа: ([0-9a-f-]{36})/);
  if (!m) return false;
  const oid = m[1];
  const chatId = String(message.chat.id);
  const { data: o } = await supabaseAdmin.from("business_orders").select("id, business_id").eq("id", oid).maybeSingle();
  if (!o || !(await authorized(chatId, String((o as any).business_id)))) return false;
  const text = String(message.text ?? "").trim();
  const tracking = text === "-" ? "" : text.slice(0, 60);
  const res = await applyAct(oid, "ship", { role: "manager", name: who(message.from) }, { tracking });
  await tgSend(token, chatId, res.ok ? `📦 Отмечено: заказ №${shortId(oid)} отправлен${tracking ? `, ТТН ${tracking}` : ""}. Покупатель уведомлён.` : ERR_TEXT[res.error ?? ""] ?? "Не получилось. Откройте заказ в приложении.");
  return true;
}
