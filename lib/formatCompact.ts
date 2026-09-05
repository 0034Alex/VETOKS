export function formatCompact(n: number): string {
  const num = Math.max(0, Math.round(n));
  if (num < 1000) return String(num);
  if (num < 1_000_000) {
    const k = num / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}к`;
  }
  const m = num / 1_000_000;
  return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}М`;
}
