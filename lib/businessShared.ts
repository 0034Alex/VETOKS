// Общее для экранов бизнес-аккаунта (без обращений к базе, можно в браузере).
export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Новый", tone: "text-gold border-gold" },
  confirmed: { label: "Подтверждён", tone: "text-[#1d9bf0] border-[#1d9bf0]" },
  shipped: { label: "Отправлен", tone: "text-[#1d9bf0] border-[#1d9bf0]" },
  done: { label: "Выполнен", tone: "text-success border-success" },
  cancelled: { label: "Отменён", tone: "text-muted border-muted" },
};

export function money(n: number | string, cur: string): string {
  const v = Math.round(Number(n) * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${cur}`;
}

export function splitSizes(s: string | null | undefined): string[] {
  return String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}
