"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectionState = {
  /** keys of the rows currently shown */
  ids: string[];
  /** selected keys, limited to rows currently shown */
  selected: string[];
  toggle: (id: string, on: boolean) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionState | null>(null);

/**
 * Checkbox selection for the rows of one table page. DataTable remounts this
 * (via `key`) whenever the page, filters or sort change, which clears it.
 */
export function RowSelectionProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  // Rows removed by a refresh drop out of the selection automatically.
  const selected = ids.filter((id) => picked.has(id));
  const value: SelectionState = {
    ids,
    selected,
    toggle: (id, on) => setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    }),
    setAll: (on) => setPicked(on ? new Set(ids) : new Set()),
    clear: () => setPicked(new Set()),
  };
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

export function useRowSelection(): SelectionState {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useRowSelection must be used inside a selectable DataTable.");
  return ctx;
}

const boxClass = "h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand-500 align-middle";

export function SelectAllCheckbox() {
  const { ids, selected, setAll } = useRowSelection();
  const all = ids.length > 0 && selected.length === ids.length;
  const some = selected.length > 0 && !all;
  return (
    <input
      type="checkbox"
      className={boxClass}
      aria-label="Select all rows on this page"
      checked={all}
      ref={(el) => { if (el) el.indeterminate = some; }}
      onChange={(e) => setAll(e.target.checked)}
    />
  );
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useRowSelection();
  return (
    <input
      type="checkbox"
      className={boxClass}
      aria-label={`Select ${label}`}
      checked={selected.includes(id)}
      onChange={(e) => toggle(id, e.target.checked)}
    />
  );
}

/**
 * Bulk-action bar above a selectable table. Always visible so the actions are
 * discoverable; the actions themselves are disabled while nothing is selected.
 */
export function SelectionBar({ children }: { children: ReactNode }) {
  const { selected, clear } = useRowSelection();
  return (
    <div className={cn("flex min-h-12 flex-wrap items-center gap-3 border-y px-4 py-2 text-sm", selected.length ? "border-brand-100 bg-brand-50/60" : "border-gray-100 bg-gray-50/60")}
      role="region" aria-label="Bulk actions">
      <span className={selected.length ? "font-semibold text-gray-800" : "text-gray-500"} aria-live="polite">
        {selected.length ? `${selected.length} selected` : "Select rows to act on several at once"}
      </span>
      {selected.length > 0 && (
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
          <X className="h-3.5 w-3.5" aria-hidden /> Clear
        </button>
      )}
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
