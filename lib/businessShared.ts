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

// Сколько штук считается «заканчивается».
export const LOW_STOCK = 3;
export const MAX_PHOTOS = 5;

export type StockState = "ok" | "low" | "out";

// Статус наличия считается сам по остатку: пусто = без ограничения.
export function stockInfo(total: number | null | undefined): { state: StockState; label: string } {
  if (total === null || total === undefined) return { state: "ok", label: "В наличии" };
  if (total <= 0) return { state: "out", label: "Закончился" };
  if (total <= LOW_STOCK) return { state: "low", label: "Заканчивается" };
  return { state: "ok", label: "В наличии" };
}

export function sizeInfo(n: number): { state: StockState; hint: string } {
  if (n <= 0) return { state: "out", hint: "нет" };
  if (n <= LOW_STOCK) return { state: "low", hint: `осталось ${n}` };
  return { state: "ok", hint: "есть" };
}

// Что видит клиент о товаре (то же, что отдаёт сервер).
export type ShopProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  details: string;
  price: number;
  photos: string[];
  photo_url: string | null;
  sizes: string;
  size_stock: Record<string, number> | null;
  stock: number | null;
  is_active?: boolean;
};

export function productTotal(p: { size_stock: Record<string, number> | null; stock: number | null }): number | null {
  if (p.size_stock && Object.keys(p.size_stock).length) return Object.values(p.size_stock).reduce((a, b) => a + Number(b || 0), 0);
  return p.stock;
}
