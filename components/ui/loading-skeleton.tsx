import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-gray-200", className)} aria-hidden />;
}

/** Page-level loading placeholder: header, stat row and a table/card block. */
export function LoadingSkeleton({ variant = "table" }: { variant?: "table" | "dashboard" | "form" }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-64" />
      </div>
      {variant === "dashboard" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}
      <div className="rounded-md bg-white p-4 shadow-card">
        {variant === "form" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : variant === "dashboard" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        )}
      </div>
    </div>
  );
}
