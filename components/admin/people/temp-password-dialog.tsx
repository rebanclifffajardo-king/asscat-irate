"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Shows a generated temporary password exactly once. */
export function TempPasswordDialog({ open, onClose, email, password, title = "Account created" }: {
  open: boolean; onClose: () => void; email?: string; password: string; title?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-4">
        <Alert tone="warning">
          Share this temporary password securely. It is shown only once; the user must change it at first login.
        </Alert>
        {email && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Login email</p>
            <p className="font-mono text-sm text-gray-900">{email}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Temporary password</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-base tracking-wider text-gray-900">{password}</code>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Copy password"
              onClick={async () => {
                await navigator.clipboard.writeText(password);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
