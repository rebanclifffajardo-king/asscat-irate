import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWith, type FlatParams } from "@/lib/url";

type Props = { page: number; pageSize: number; total: number; basePath: string; params: FlatParams };

export function Pagination({ page, pageSize, total, basePath, params }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => windowStart + i);
  const link = (p: number) => hrefWith(basePath, params, { page: p === 1 ? null : p });

  return (
    <nav className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row" aria-label="Pagination">
      <p className="text-sm text-gray-600">
        Showing <span className="font-semibold">{start}</span>–<span className="font-semibold">{end}</span> of{" "}
        <span className="font-semibold">{total}</span>
      </p>
      {pages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <PageLink href={link(page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </PageLink>
          </li>
          {nums.map((n) => (
            <li key={n}>
              <PageLink href={link(n)} active={n === page} label={`Page ${n}`}>
                {n}
              </PageLink>
            </li>
          ))}
          <li>
            <PageLink href={link(page + 1)} disabled={page >= pages} label="Next page">
              <ChevronRight className="h-4 w-4" />
            </PageLink>
          </li>
        </ul>
      )}
    </nav>
  );
}

function PageLink({ href, children, active, disabled, label }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean; label: string }) {
  const cls = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-semibold",
    active ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={cls} aria-disabled="true" aria-label={label}>{children}</span>;
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={active ? "page" : undefined} scroll={false}>
      {children}
    </Link>
  );
}
