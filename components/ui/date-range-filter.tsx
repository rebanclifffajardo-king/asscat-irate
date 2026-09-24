"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** From/To date inputs bound to `from` and `to` URL params. */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = (key: "from" | "to", value: string) => {
    const q = new URLSearchParams(sp.toString());
    if (value) q.set(key, value); else q.delete(key);
    q.delete("page");
    startTransition(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  };
  const cls = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60";
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">From
        <input type="date" className={cls} disabled={pending} value={sp.get("from") ?? ""} max={sp.get("to") ?? undefined} onChange={(e) => set("from", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">To
        <input type="date" className={cls} disabled={pending} value={sp.get("to") ?? ""} min={sp.get("from") ?? undefined} onChange={(e) => set("to", e.target.value)} />
      </label>
    </>
  );
}
