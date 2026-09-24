"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, RotateCcw, UserMinus } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { MenuItem } from "@/components/ui/dropdown-menu";
import { removeEnrollment, resetEvaluationAttempt } from "@/app/admin/surveys/actions";
import { ViewAnswersModal } from "./view-answers-modal";

export function EnrollmentRowActions({ enrollmentId, offeringId, attemptId, studentName }: {
  enrollmentId: string; offeringId: string; attemptId: string | null; studentName: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(false);
  const [confirm, setConfirm] = useState<null | "reset" | "remove">(null);
  const done = (res: { ok: boolean; message?: string; error?: string }) => {
    if (res.ok) { toast.success(res.message); setConfirm(null); router.refresh(); } else toast.error(res.error);
  };

  const items: MenuItem[] = attemptId
    ? [
        { label: "View Answers", icon: <Eye className="h-4 w-4" />, onSelect: () => setView(true) },
        { type: "separator" },
        { label: "Delete Attempt", icon: <RotateCcw className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm("reset") },
      ]
    : [{ label: "Remove from class", icon: <UserMinus className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm("remove") }];

  return (
    <>
      <RowActions items={items} label={`Actions for ${studentName}`} />
      {view && attemptId && <ViewAnswersModal attemptId={attemptId} onClose={() => setView(false)} />}
      <ConfirmationDialog
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title="Reset evaluation?"
        message="Are you sure you want to reset this student's evaluation? The student will be allowed to answer the evaluation again."
        confirmLabel="Reset evaluation"
        onConfirm={async () => done(await resetEvaluationAttempt({ attemptId: attemptId!, offeringId }))}
      />
      <ConfirmationDialog
        open={confirm === "remove"}
        onClose={() => setConfirm(null)}
        title="Remove student from class?"
        message={<>Remove <strong>{studentName}</strong> from this class? They will no longer be expected to evaluate it.</>}
        confirmLabel="Remove"
        onConfirm={async () => done(await removeEnrollment({ enrollmentId, offeringId }))}
      />
    </>
  );
}
