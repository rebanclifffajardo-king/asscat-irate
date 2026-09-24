import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function PageHeader({ title, description, breadcrumbs, actions }: {
  title: string; description?: ReactNode; breadcrumbs?: Crumb[]; actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
              {breadcrumbs.map((b, i) => (
                <li key={`${b.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                  {b.href ? <Link href={b.href} className="hover:text-brand-600">{b.label}</Link> : <span aria-current="page">{b.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
