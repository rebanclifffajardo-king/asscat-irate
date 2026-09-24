"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MenuItem =
  | { type?: "item"; label: string; icon?: ReactNode; onSelect: () => void; tone?: "default" | "danger"; disabled?: boolean }
  | { type: "separator" };

type Props = {
  trigger: (props: { open: boolean; id: string; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  items?: MenuItem[];
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
  label: string;
};

/** Accessible dropdown (button + role=menu), keyboard navigable, closes on outside click/Escape. */
export function DropdownMenu({ trigger, items, children, align = "right", className, label }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus());
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); nodes[(i + 1) % nodes.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); nodes[(i - 1 + nodes.length) % nodes.length]?.focus(); }
    if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className={cn("relative inline-block text-left", className)}>
      {trigger({ open, id, toggle: () => setOpen((o) => !o), ref: btnRef })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          aria-labelledby={id}
          onKeyDown={onMenuKey}
          className={cn(
            "absolute z-40 mt-1 min-w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
          {items?.map((item, idx) =>
            item.type === "separator" ? (
              <div key={`sep-${idx}`} className="my-1 border-t border-gray-100" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm focus:outline-none disabled:opacity-50",
                  item.tone === "danger"
                    ? "text-red-600 hover:bg-red-50 focus:bg-red-50"
                    : "text-gray-700 hover:bg-gray-100 focus:bg-gray-100",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
