"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useRowSelection } from "@/components/ui/row-selection";
import { OfferingDeleteDialog } from "@/components/admin/survey/offering-delete-dialog";
import { StudentDeleteDialog } from "@/components/admin/people/student-delete-dialog";
import { deleteOfferings, removeEnrollments, type BulkResult } from "@/app/admin/surveys/actions";
import { deleteStudents } from "@/app/admin/students/actions";
import { deleteFaculties } from "@/app/admin/faculty/actions";

type Result = { ok: true; data: BulkResult; message?: string } | { ok: false; error: string };

/** Toasts a bulk result (listing skipped rows), clears the selection and refreshes the table. */
function useBulkRunner() {
  const router = useRouter();
  const { clear } = useRowSelection();
  return (res: Result, close: () => void) => {
    if (!res.ok) { toast.error(res.error); return; }
    const { done, skipped } = res.data;
    const details = skipped.slice(0, 5).map((s) => `${s.label}: ${s.reason}`).join("\n") + (skipped.length > 5 ? `\n…and ${skipped.length - 5} more` : "");
    if (!skipped.length) toast.success(res.message);
    else if (done) toast.warning(res.message, { description: details });
    else toast.error(res.message, { description: details });
    clear();
    close();
    router.refresh();
  };
}

/** Delete-selected button + standard confirmation dialog. */
function BulkDeleteButton({ label = "Delete Selected", icon = <Trash2 className="h-4 w-4" />, title, message, confirmLabel = "Delete", run }: {
  label?: string; icon?: React.ReactNode; title: string; message: (count: number) => React.ReactNode; confirmLabel?: string;
  run: (ids: string[]) => Promise<Result>;
}) {
  const { selected } = useRowSelection();
  const report = useBulkRunner();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} disabled={!selected.length}>{icon} {label} ({selected.length})</Button>
      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        message={message(selected.length)}
        confirmLabel={confirmLabel}
        onConfirm={async () => report(await run(selected), () => setOpen(false))}
      />
    </>
  );
}

export function BulkRemoveEnrollmentsButton({ offeringId }: { offeringId: string }) {
  return (
    <BulkDeleteButton
      label="Remove Selected"
      icon={<UserMinus className="h-4 w-4" />}
      title="Remove selected students?"
      confirmLabel="Remove"
      message={(n) => (
        <>
          <p>Remove <strong>{n}</strong> selected student(s) from this class?</p>
          <p className="mt-2">Students who already have an evaluation for this class are skipped. Reset their evaluation first to remove them.</p>
        </>
      )}
      run={(ids) => removeEnrollments({ offeringId, enrollmentIds: ids })}
    />
  );
}

/** Students use the cascade-warning dialog (their enrollments and evaluations are deleted too). */
export function BulkDeleteStudentsButton() {
  const { selected } = useRowSelection();
  const report = useBulkRunner();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} disabled={!selected.length}><Trash2 className="h-4 w-4" /> Delete Selected ({selected.length})</Button>
      {open && (
        <StudentDeleteDialog ids={selected} onClose={() => setOpen(false)}
          onConfirm={async (ids) => report(await deleteStudents(ids), () => setOpen(false))} />
      )}
    </>
  );
}

export function BulkDeleteFacultyButton() {
  return (
    <BulkDeleteButton
      title="Delete selected faculty?"
      message={(n) => (
        <>
          <p>Are you sure you want to delete the <strong>{n}</strong> selected faculty member(s)? This action cannot be undone.</p>
          <p className="mt-2">Their login accounts and photos are deleted too. Faculty with assigned classes cannot be deleted and will be skipped — deactivate them instead.</p>
        </>
      )}
      run={deleteFaculties}
    />
  );
}

/** Survey classes use the cascade-warning dialog (evaluation records are deleted too). */
export function BulkDeleteOfferingsButton() {
  const { selected } = useRowSelection();
  const report = useBulkRunner();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} disabled={!selected.length}><Trash2 className="h-4 w-4" /> Delete Selected ({selected.length})</Button>
      {open && (
        <OfferingDeleteDialog ids={selected} onClose={() => setOpen(false)}
          onConfirm={async (ids) => report(await deleteOfferings(ids), () => setOpen(false))} />
      )}
    </>
  );
}
