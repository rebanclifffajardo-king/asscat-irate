import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWith, type FlatParams } from "@/lib/url";
import { RowCheckbox, RowSelectionProvider, SelectAllCheckbox, SelectionBar } from "./row-selection";

export type Column<T> = {
  key: string;
  header: string;
  /** server-side sort key (must be whitelisted by the page) */
  sortKey?: string;
  className?: string;
  cell: (row: T) => ReactNode;
  /** shown as the card title on mobile */
  primary?: boolean;
  /** row actions: rendered top-right on mobile cards */
  isAction?: boolean;
  hideOnMobile?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  basePath?: string;
  params?: FlatParams;
  sort?: string;
  dir?: "asc" | "desc";
  empty?: ReactNode;
  caption?: string;
  /**
   * Opt-in checkbox selection. `actions` are client components rendered in a
   * bar above the table while rows are selected; they read the selected row
   * keys with `useRowSelection()`. Selection clears when params change.
   */
  selection?: { rowLabel: (row: T) => string; actions: ReactNode };
};

/**
 * Server-rendered data table. Sorting is link-based (URL params) so it works
 * with server-side pagination. On small screens rows become cards.
 */
export function DataTable<T>({ columns, rows, rowKey, basePath, params = {}, sort, dir, empty, caption, selection }: Props<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const action = columns.find((c) => c.isAction);
  const checkbox = (row: T) => (selection ? <RowCheckbox id={rowKey(row)} label={selection.rowLabel(row)} /> : null);

  const table = (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-gray-50">
            <tr>
              {selection && (
                <th scope="col" className="w-10 px-4 py-2.5 text-left"><SelectAllCheckbox /></th>
              )}
              {columns.map((c) => {
                const active = c.sortKey && sort === c.sortKey;
                const nextDir = active && dir === "asc" ? "desc" : "asc";
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("whitespace-nowrap px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-600", c.className)}
                  >
                    {c.sortKey && basePath ? (
                      <Link
                        href={hrefWith(basePath, params, { sort: c.sortKey, dir: nextDir, page: null })}
                        className="inline-flex items-center gap-1 hover:text-gray-900"
                        scroll={false}
                      >
                        {c.header}
                        {active ? (
                          dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
                        )}
                      </Link>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-gray-50/80">
                {selection && <td className="w-10 px-4 py-2.5 align-middle">{checkbox(row)}</td>}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-2.5 align-middle text-gray-700", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selection && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm text-gray-600 md:hidden">
          <SelectAllCheckbox /> Select all on this page
        </div>
      )}
      <ul className="divide-y divide-gray-100 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {selection && <span className="pt-0.5">{checkbox(row)}</span>}
                <div className="min-w-0 font-semibold text-gray-900">{primary.cell(row)}</div>
              </div>
              {action && <div className="shrink-0">{action.cell(row)}</div>}
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {columns
                .filter((c) => c !== primary && c !== action && !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-gray-500">{c.header}</dt>
                    <dd className="min-w-0 text-gray-800">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );

  if (!selection) return table;
  // Remounting on any page/filter/sort change clears the selection.
  return (
    <RowSelectionProvider key={JSON.stringify(params)} ids={rows.map(rowKey)}>
      <SelectionBar>{selection.actions}</SelectionBar>
      {table}
    </RowSelectionProvider>
  );
}
