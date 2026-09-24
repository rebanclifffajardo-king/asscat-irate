"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

type Opt = { value: string; label: string };

export type FilterValues = { sy: string; sem: string; department: string; program: string; faculty: string; subject: string };

/**
 * One-row global filter bar. Values are explicit in the URL ("all" = no
 * filter) so the resolved default period is always visible to the user.
 */
export function AnalyticsFilters({ values, years, departments, programs, faculty, subjects }: {
  values: FilterValues; years: Opt[]; departments: Opt[]; programs: Opt[]; faculty?: Opt[]; subjects?: Opt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (key: keyof FilterValues, value: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("sy", values.sy || "all");
    q.set("sem", values.sem || "all");
    if (value) q.set(key, value); else q.delete(key);
    startTransition(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  };

  const select = (key: keyof FilterValues, label: string, opts: Opt[], allLabel: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-gray-600">
      {label}
      <select
        value={values[key] || (key === "sy" || key === "sem" ? "all" : "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={pending}
        className="h-10 w-full cursor-pointer rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60"
      >
        <option value={key === "sy" || key === "sem" ? "all" : ""}>{allLabel}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="no-print mb-5 rounded-md bg-white p-3 shadow-card">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:flex xl:items-end [&>*]:xl:flex-1">
        {select("sy", "School Year", years, "All school years")}
        {select("sem", "Semester", [{ value: "1", label: "1st Semester" }, { value: "2", label: "2nd Semester" }], "Both semesters")}
        {select("department", "Department", departments, "All departments")}
        {select("program", "Program", programs, "All programs")}
        {faculty && select("faculty", "Faculty", faculty, "All faculty")}
        {subjects && select("subject", "Subject", subjects, "All subjects")}
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 md:col-span-1 xl:flex-none"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset
        </button>
      </div>
    </div>
  );
}
