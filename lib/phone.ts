// Приводит номер к единому виду: только цифры с плюсом впереди.
export function normalizePhone(raw: string): string {
  let d = String(raw).replace(/\D/g, "");
  // украинский номер, введённый как 0XXXXXXXXX
  if (d.length === 10 && d.startsWith("0")) d = "38" + d;
  return "+" + d;
}

// Варианты записи, под которыми номер мог быть сохранён раньше.
export function phoneVariants(raw: string): string[] {
  const n = normalizePhone(raw);
  return [n, n.replace("+", "")];
}
