import { apiPost } from "@/lib/authClient";

// Оплата рекламной заявки в один клик. Если денег не хватает и в CRM включено
// тестовое пополнение — пополняем +1000 и повторяем оплату (как с голосами).
export async function payAdRequest(requestId: string): Promise<{ ok: boolean; message: string; test?: boolean; published?: boolean }> {
  let r = await apiPost("/api/ad/pay", { requestId });
  let usedTest = false;
  if (!r?.ok && r?.error === "not_enough") {
    const c = await apiPost("/api/shop/test-topup", { check: true });
    if (c?.ok && c.enabled) {
      const t = await apiPost("/api/shop/test-topup");
      if (t?.ok) {
        usedTest = true;
        r = await apiPost("/api/ad/pay", { requestId });
      }
    }
  }
  if (r?.ok) {
    return {
      ok: true,
      test: usedTest,
      published: !!r.published,
      message: r.published
        ? `Оплачено! Реклама запущена${r.until ? ` и будет в эфире до ${new Date(r.until).toLocaleDateString("ru-RU")}` : ""}. Править материал можно в Кабинете партнёра.`
        : "Оплачено! Место закреплено за вами. Материал для этого места менеджер поставит вручную.",
    };
  }
  const m: Record<string, string> = {
    not_enough: `Не хватает денег на балансе (сейчас ${Math.round(Number(r?.balance ?? 0))}). Пополните баланс.`,
    need_parent: "Для оплаты нужно согласие родителей.",
    slot_full: "Это место уже выкуплено.",
    expired: "Время на оплату (24 часа) вышло. Напишите в поддержку — продлим.",
    not_approved: "Эта заявка уже оплачена или не одобрена.",
  };
  return { ok: false, message: m[String(r?.error)] ?? "Не получилось оплатить. Попробуйте ещё раз." };
}
