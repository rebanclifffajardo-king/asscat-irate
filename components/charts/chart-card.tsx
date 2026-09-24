"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type ChartTable = { columns: string[]; rows: (string | number)[][] };

/** Card wrapper for a chart with a Chart/Table toggle (accessible table view). */
export function ChartCard({ title, description, table, empty, children, className, actions }: {
  title: string; description?: ReactNode; table?: ChartTable; empty?: boolean; children: ReactNode; className?: string; actions?: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cn("print-avoid flex flex-col", className)}>
      <CardHeader
        title={title}
        description={description}
        actions={
          <>
            {actions}
            {table && !empty && (
              <div className="no-print inline-flex rounded-md border border-gray-200 p-0.5" role="group" aria-label="View">
                <button type="button" onClick={() => setView("chart")} aria-pressed={view === "chart"} aria-label="Chart view"
                  className={cn("rounded p-1", view === "chart" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700")}>
                  <BarChart3 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} aria-label="Table view"
                  className={cn("rounded p-1", view === "table" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700")}>
                  <Table2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        }
      />
      <div className="flex-1 p-4">
        {empty ? (
          <EmptyState title="No data yet" description="Nothing matches the selected filters." className="py-10" />
        ) : view === "table" && table ? (
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                <tr>{table.columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5", j > 0 && "tabular-nums")}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
