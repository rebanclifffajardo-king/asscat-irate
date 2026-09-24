"use client";

import { MoreVertical } from "lucide-react";
import { DropdownMenu, type MenuItem } from "./dropdown-menu";

/** Kebab menu used in the "Action" column of data tables. */
export function RowActions({ items, label = "Row actions" }: { items: MenuItem[]; label?: string }) {
  return (
    <DropdownMenu
      label={label}
      items={items}
      trigger={({ open, id, toggle, ref }) => (
        <button
          ref={ref}
          id={id}
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
    />
  );
}
