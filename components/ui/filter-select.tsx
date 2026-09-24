"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

/** Select bound to a URL search parameter; resets pagination on change. */
export function FilterSelect({
  param, label, options, allLabel = "All", className, resetParams = [],
}: { param: string; label: string; options: Option[]; allLabel?: string | null; className?: string; resetParams?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const value = sp.get(param) ?? "";

  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-semibold text-gray-600", className)}>
      <span>{label}</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          if (e.target.value) q.set(param, e.target.value);
          else q.delete(param);
          q.delete("page");
          for (const r of resetParams) q.delete(r);
          startTransition(() => router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false }));
        }}
        className="h-10 w-full min-w-36 cursor-pointer rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60"
      >
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
