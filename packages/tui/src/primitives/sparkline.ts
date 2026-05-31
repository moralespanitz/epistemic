const BLOCKS = "▁▂▃▄▅▆▇█";

export function sparkline(series: number[]): string {
  if (series.length === 0) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min;
  return series
    .map((v) => {
      const idx = span === 0 ? 0 : Math.round(((v - min) / span) * (BLOCKS.length - 1));
      return BLOCKS[idx];
    })
    .join("");
}
