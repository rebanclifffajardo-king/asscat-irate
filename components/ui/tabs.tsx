"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: ReactNode; content: ReactNode };

/** Client-side tabs with WAI-ARIA tablist semantics and arrow-key navigation. */
export function Tabs({ tabs, defaultTab, className }: { tabs: TabItem[]; defaultTab?: string; className?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    setActive(tabs[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  return (
    <div className={className}>
      <div ref={listRef} role="tablist" onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
              active === t.id ? "border-brand-500 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${base}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={active !== t.id}
          className="pt-4"
        >
          {active === t.id && t.content}
        </div>
      ))}
    </div>
  );
}
