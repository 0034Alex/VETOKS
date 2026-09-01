export function coinsLabel(n: number): string {
  const abs = Math.abs(Math.round(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "Т-коинов";
  if (last === 1) return "Т-коин";
  if (last >= 2 && last <= 4) return "Т-коина";
  return "Т-коинов";
}

export function formatCoins(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} ${coinsLabel(n)}`;
}
