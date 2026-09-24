/**
 * Chart color roles (validated with the dataviz palette validator against the
 * white card surface):
 *  - SINGLE: brand green for single-series charts.
 *  - CATEGORICAL: reference order (adjacent-pair CVD-safe) for multi-series;
 *    brand green is not mixed in because green↔orange fails all-pairs CVD.
 *  - ORDINAL_GREEN: rating 1→5 ramp (monotone, light end ≥ 2:1 on white).
 */
export const SINGLE = "#28a745";
export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const ORDINAL_GREEN = ["#6cc084", "#45ab62", "#2a8f47", "#1d7336", "#135726"];
export const REMAINDER = "#d1d5db";
export const GRID = "#eceef1";
export const AXIS = "#6b7280";
export const TEXT = "#1f2937";

export type ValueFormat = "rating" | "count" | "percent";

export function fmt(v: number | string | null | undefined, format: ValueFormat): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (format === "rating") return n.toFixed(2);
  if (format === "percent") return `${n.toFixed(1)}%`;
  return new Intl.NumberFormat("en-PH").format(n);
}

/** Ordinal ramp sampled to n steps (for scales other than 1–5). */
export function ordinalColors(n: number): string[] {
  if (n <= ORDINAL_GREEN.length) return ORDINAL_GREEN.slice(ORDINAL_GREEN.length - n);
  return Array.from({ length: n }, (_, i) => ORDINAL_GREEN[Math.round((i / (n - 1)) * (ORDINAL_GREEN.length - 1))]);
}
