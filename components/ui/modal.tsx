"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof sizes;
  children: ReactNode;
  footer?: ReactNode;
  /** prevent closing while an operation is pending */
  busy?: boolean;
};

/**
 * Accessible modal built on the native <dialog> element (focus trapping,
 * Escape handling and inert background come from the browser).
 */
export function Modal({ open, onClose, title, description, size = "md", children, footer, busy }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg bg-white p-0 text-gray-900 shadow-2xl backdrop:backdrop-blur-[1px]",
        "max-h-[calc(100dvh-2rem)]",
        sizes[size],
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
              {description && <p id={descId} className="mt-0.5 text-sm text-gray-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="-mr-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 rounded-b-lg">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
