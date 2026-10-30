// Общее для экранов бизнес-аккаунта (без обращений к базе, можно в браузере).
type St = { label: string; tone: string };
const TONE_GOLD = "text-gold border-gold";
const TONE_BLUE = "text-[#1d9bf0] border-[#1d9bf0]";
const TONE_OK = "text-success border-success";
const TONE_OFF = "text-muted border-muted";

export const ORDER_STATUS: Record<string, St> = {
  new: { label: "Новый", tone: TONE_GOLD },
  confirmed: { label: "Подтверждён", tone: TONE_BLUE },
  shipped: { label: "Отправлен", tone: TONE_BLUE },
  done: { label: "Выполнен", tone: TONE_OK },
  cancelled: { label: "Отменён", tone: TONE_OFF },
};

// У подарка свои названия статусов.
export const GIFT_STATUS: Record<string, St> = {
  new: { label: "Ждёт оплаты", tone: TONE_GOLD },
  paid: { label: "Оплачен", tone: TONE_BLUE },
  accepted: { label: "Принят, уточняем адрес", tone: TONE_BLUE },
  shipped: { label: "Отправлен", tone: TONE_BLUE },
  received: { label: "Получено", tone: TONE_OK },
  declined: { label: "Участница отказалась", tone: TONE_OFF },
  cancelled: { label: "Отменён", tone: TONE_OFF },
};

export const GIFT_STEPS = ["new", "paid", "accepted", "shipped", "received"];

export function statusInfo(kind: string, status: string): St {
  const m = kind === "gift" ? GIFT_STATUS : ORDER_STATUS;
  return m[status] ?? m.new;
}

export function money(n: number | string, cur: string): string {
  const v = Math.round(Number(n) * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${cur}`;
}

export function splitSizes(s: string | null | undefined): string[] {
  return String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}
