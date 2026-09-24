import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  brand: "bg-brand-500 text-white",
  info: "bg-lte-info text-white",
  warning: "bg-lte-warning text-gray-900",
  danger: "bg-lte-danger text-white",
  primary: "bg-lte-primary text-white",
  dark: "bg-sidebar text-white",
} as const;

/** AdminLTE "small-box": big number, label, faded icon and optional footer link. */
export function StatCard({ label, value, icon, tone = "brand", href, footer, sub }: {
  label: string; value: ReactNode; icon: ReactNode; tone?: keyof typeof tones; href?: string; footer?: string; sub?: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-md shadow-card", tones[tone])}>
      <div className="relative z-10 p-4">
        <p className="text-3xl font-bold leading-tight tabular-nums">{value}</p>
        <p className="mt-1 text-sm font-semibold opacity-95">{label}</p>
        {sub && <p className="mt-0.5 text-xs opacity-80">{sub}</p>}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 opacity-20 [&>svg]:h-16 [&>svg]:w-16" aria-hidden>{icon}</div>
      {href && (
        <Link href={href} className="relative z-10 flex items-center justify-center gap-1 bg-black/10 py-1.5 text-xs font-semibold hover:bg-black/20">
          {footer ?? "More info"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** AdminLTE "info-box": colored icon tile + label + value (+ optional progress). */
export function AnalyticsCard({ label, value, icon, tone = "brand", progress, hint }: {
  label: string; value: ReactNode; icon: ReactNode; tone?: keyof typeof tones; progress?: number; hint?: ReactNode;
}) {
  return (
    <div className="flex min-h-[86px] items-stretch gap-3 rounded-md bg-white p-2.5 shadow-card">
      <span className={cn("flex w-16 shrink-0 items-center justify-center rounded-md [&>svg]:h-7 [&>svg]:w-7", tones[tone])} aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate text-sm text-gray-600">{label}</p>
        <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
        {typeof progress === "number" && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-gray-200" role="presentation">
            <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
        {hint && <p className="mt-0.5 truncate text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}
