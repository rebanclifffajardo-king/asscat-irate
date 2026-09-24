import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered tabs driven by a URL parameter (deep-linkable). */
export function LinkTabs({ tabs, active, basePath, param = "tab" }: { tabs: { id: string; label: string }[]; active: string; basePath: string; param?: string }) {
  return (
    <nav className="-mx-1 overflow-x-auto px-1" aria-label="Sections">
      <ul className="flex min-w-max gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <li key={t.id}>
            <Link
              href={`${basePath}?${param}=${t.id}`}
              aria-current={active === t.id ? "page" : undefined}
              scroll={false}
              className={cn(
                "-mb-px block whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                active === t.id ? "border-brand-500 text-brand-700" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
