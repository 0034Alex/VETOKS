// Блюда бизнес-аккаунта «Еда» (без обращений к базе, можно в браузере).
export type ModOption = { name: string; price: number };
// single: обязательный выбор одного (размер), multi: добавки за доплату, remove: «убрать из блюда».
export type ModGroup = { id: string; title: string; type: "single" | "multi" | "remove"; options: ModOption[] };
export type Dish = {
  id: string;
  name: string;
  description: string;
  weight: string;
  price: number;
  category: string;
  photo_url: string | null;
  modifiers: ModGroup[];
  in_stock: boolean;
  is_active?: boolean;
};
export type CartLine = { key: string; dishId: string; qty: number; mods: Record<string, string[]> };

export const MAX_LINE_QTY = 20;

export const modTypeLabel: Record<string, string> = { single: "Обязательный выбор", multi: "Добавки", remove: "Убрать из блюда" };

// Цена одной порции с выбранными модификаторами.
export function unitPrice(d: Dish, mods: Record<string, string[]>): number {
  let p = Number(d.price) || 0;
  for (const g of d.modifiers) {
    if (g.type === "remove") continue;
    for (const n of mods[g.id] ?? []) p += Number(g.options.find((o) => o.name === n)?.price) || 0;
  }
  return Math.round(p * 100) / 100;
}

// Текст выбранного: «40 см, +Двойной сыр, без лука».
export function modsText(d: Dish, mods: Record<string, string[]>): string {
  const out: string[] = [];
  for (const g of d.modifiers) {
    for (const n of mods[g.id] ?? []) out.push(g.type === "multi" ? `+${n}` : g.type === "remove" ? `без ${n.toLowerCase()}` : n);
  }
  return out.join(", ");
}

// Какие обязательные группы не выбраны.
export function missingRequired(d: Dish, mods: Record<string, string[]>): string | null {
  for (const g of d.modifiers) if (g.type === "single" && (mods[g.id] ?? []).length !== 1) return g.title;
  return null;
}
