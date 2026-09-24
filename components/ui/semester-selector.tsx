"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";

export type PeriodOption = { id: string; label: string; is_current: boolean; status?: string | null };

/** School year + semester selector bound to the `period` URL param. */
export function SemesterSelector({ periods, value, param = "period", includeAll = false, label = "Select Academic Year", resetParams = [] }: {
  periods: PeriodOption[]; value: string; param?: string; includeAll?: boolean; label?: string;
  /** other URL params cleared on change (e.g. a dependent subject filter) */
  resetParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {pending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" aria-hidden /> : <CalendarRange className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />}
        <select
          value={value}
          disabled={pending}
          onChange={(e) => {
            const q = new URLSearchParams(sp.toString());
            q.set(param, e.target.value || "all");
            q.delete("page");
            for (const r of resetParams) q.delete(r);
            startTransition(() => router.replace(`${pathname}?${q}`, { scroll: false }));
          }}
          className="h-10 max-w-full cursor-pointer rounded-md border border-gray-300 bg-white px-3 pr-8 text-sm font-semibold text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        >
          {includeAll && <option value="all">All school years &amp; semesters</option>}
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}{p.is_current ? " (Current)" : ""}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
