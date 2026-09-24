"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary" | "warning";
};

export function ConfirmationDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", tone = "danger" }: Props) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  const Icon = tone === "primary" ? Info : AlertTriangle;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={tone === "primary" ? "primary" : tone} onClick={handle} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={
            tone === "danger"
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"
              : tone === "warning"
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="pt-1 text-sm text-gray-700">{message}</div>
      </div>
    </Modal>
  );
}
