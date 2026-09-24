import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_SCALE = [
  { value: 1, label: "Poor" }, { value: 2, label: "Fair" }, { value: 3, label: "Good" },
  { value: 4, label: "Very Good" }, { value: 5, label: "Excellent" },
];

export type ScalePoint = { value: number; label: string };

/** Verbal equivalent of an average rating on the configured scale. */
export function ratingLabel(value: number | null | undefined, scale: ScalePoint[] = DEFAULT_SCALE): string {
  if (value === null || value === undefined) return "—";
  const nearest = scale.reduce((best, p) => (Math.abs(p.value - value) < Math.abs(best.value - value) ? p : best), scale[0]);
  return nearest?.label ?? "—";
}

/** Numeric rating + stars + verbal equivalent. */
export function RatingDisplay({ value, max = 5, scale, showLabel = true, size = "sm", className }: {
  value: number | string | null | undefined; max?: number; scale?: ScalePoint[]; showLabel?: boolean; size?: "sm" | "md"; className?: string;
}) {
  if (value === null || value === undefined || value === "") return <span className="text-gray-400">—</span>;
  const v = Number(value);
  const pct = Math.max(0, Math.min(1, v / max)) * 100;
  const icon = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label={`${v.toFixed(2)} out of ${max}`}>
      <span className={cn("font-bold tabular-nums text-gray-900", size === "md" && "text-xl")}>{v.toFixed(2)}</span>
      <span className="relative inline-flex" aria-hidden>
        <span className="flex text-gray-300">
          {Array.from({ length: max }, (_, i) => <Star key={i} className={cn(icon, "fill-current")} />)}
        </span>
        <span className="absolute inset-0 flex overflow-hidden text-amber-400" style={{ width: `${pct}%` }}>
          {Array.from({ length: max }, (_, i) => <Star key={i} className={cn(icon, "shrink-0 fill-current")} />)}
        </span>
      </span>
      {showLabel && <span className="text-xs font-semibold text-gray-500">{ratingLabel(v, scale)}</span>}
    </span>
  );
}
