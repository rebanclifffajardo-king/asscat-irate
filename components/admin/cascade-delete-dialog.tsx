"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/field";

export type CascadeImpact = { enrollments: number; completed: number; inProgress: number };
type ImpactResult = { ok: true; data: CascadeImpact } | { ok: false; error: string };

/**
 * Permanent-delete confirmation that loads what else would be removed. When
 * evaluation or enrollment records exist it shows a cascade warning and
 * requires an explicit acknowledgement. Mount it only while open.
 */
export function CascadeDeleteDialog({ ids, title, subject, loadImpact, warningTitle, warningText, unaffected, warnOnEnrollments = false, onClose, onConfirm }: {
  ids: string[];
  title: string;
  /** e.g. <strong>IT 101</strong> or "3 selected students" */
  subject: ReactNode;
  loadImpact: (ids: string[]) => Promise<ImpactResult>;
  warningTitle: string;
  warningText: ReactNode;
  /** what is guaranteed not to be deleted */
  unaffected: string;
  /** show the cascade warning when only enrollments (no evaluations) exist */
  warnOnEnrollments?: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<void>;
}) {
  // Snapshot the targets when the dialog opens.
  const [target] = useState(ids);
  const [impact, setImpact] = useState<CascadeImpact | "error" | null>(null);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    let live = true;
    loadImpact(target).then(
      (r) => { if (live) setImpact(r.ok ? r.data : "error"); },
      () => { if (live) setImpact("error"); },
    );
    return () => { live = false; };
  }, [target, loadImpact]);

  const hasRecords = impact === "error" ||
    (impact !== null && impact.completed + impact.inProgress + (warnOnEnrollments ? impact.enrollments : 0) > 0);

  let message: ReactNode;
  if (impact === null) {
    message = <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking related records…</p>;
  } else if (hasRecords) {
    message = (
      <div className="space-y-3">
        <Alert tone="danger" title={warningTitle}>{warningText}</Alert>
        <p>You are about to delete {subject}.</p>
        {impact !== "error" && (
          <ul className="list-disc space-y-0.5 pl-5">
            <li><strong>{impact.completed}</strong> submitted evaluation(s), with their answers and comments</li>
            {impact.inProgress > 0 && <li><strong>{impact.inProgress}</strong> evaluation(s) in progress</li>}
            <li><strong>{impact.enrollments}</strong> class enrollment(s)</li>
          </ul>
        )}
        <p className="text-xs text-gray-500">{unaffected}</p>
        <Checkbox label="I understand that these records will be permanently deleted and this cannot be undone." checked={ack} onChange={(e) => setAck(e.target.checked)} />
      </div>
    );
  } else {
    message = (
      <>
        <p>
          Permanently delete {subject}?{impact.enrollments > 0 && <> Its <strong>{impact.enrollments}</strong> class enrollment(s) will also be removed.</>} This
          action cannot be undone.
        </p>
        <p className="mt-2 text-xs text-gray-500">{unaffected}</p>
      </>
    );
  }

  return (
    <ConfirmationDialog
      open
      onClose={onClose}
      title={title}
      message={message}
      confirmLabel="Delete permanently"
      confirmDisabled={impact === null || (hasRecords && !ack)}
      onConfirm={() => onConfirm(target)}
    />
  );
}
