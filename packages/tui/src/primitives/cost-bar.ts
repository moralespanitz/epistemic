export function costBar(spent: number, cap: number, width: number): string {
  const ratio = cap > 0 ? spent / cap : 0;
  const pct = Math.min(Math.round(ratio * 100), 100);
  const filled = Math.min(Math.max(Math.round(ratio * width), spent > 0 ? 1 : 0), width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)} ${pct}%]`;
}
