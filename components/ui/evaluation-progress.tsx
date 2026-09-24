import { cn } from "@/lib/utils";
import { percent } from "@/lib/format";

/** "6 / 30 evaluations completed" + progress bar. */
export function EvaluationProgress({ completed, total, compact, className }: { completed: number; total: number; compact?: boolean; className?: string }) {
  const pct = percent(completed, total, 0);
  const color = pct >= 80 ? "bg-brand-500" : pct >= 50 ? "bg-lte-info" : pct >= 25 ? "bg-lte-warning" : "bg-lte-danger";
  return (
    <div className={cn("min-w-32", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-gray-800 tabular-nums">
          {completed} / {total}
          {!compact && <span className="font-normal text-gray-500"> evaluations completed</span>}
        </span>
        <span className="tabular-nums text-gray-500">{pct}%</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} of ${total} evaluations completed`}
      >
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
