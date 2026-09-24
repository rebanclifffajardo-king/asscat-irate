"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Debounced search box synced to the `q` URL parameter (server-side search). */
export function SearchInput({ placeholder = "Search…", className, param = "q" }: { placeholder?: string; className?: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = new URLSearchParams(sp.toString());
      if (value.trim()) q.set(param, value.trim());
      else q.delete(param);
      q.delete("page");
      startTransition(() => router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <label className="sr-only" htmlFor={`search-${param}`}>{placeholder}</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input
        id={`search-${param}`}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-9 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
      />
      {pending ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />
      ) : value ? (
        <button type="button" onClick={() => setValue("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
