"use client";

import { CascadeDeleteDialog } from "@/components/admin/cascade-delete-dialog";
import { getStudentDeletionImpact } from "@/app/admin/students/actions";

/** Student delete: removes their enrollments and evaluations too. Mount only while open. */
export function StudentDeleteDialog({ ids, name, onClose, onConfirm }: {
  ids: string[]; name?: string; onClose: () => void; onConfirm: (ids: string[]) => Promise<void>;
}) {
  const many = ids.length > 1;
  return (
    <CascadeDeleteDialog
      ids={ids}
      title={many ? `Delete ${ids.length} students?` : "Delete student?"}
      subject={name ? <><strong>{name}</strong> and their login account</> : <><strong>{ids.length}</strong> selected student(s) and their login accounts</>}
      loadImpact={getStudentDeletionImpact}
      warningTitle={many ? "Warning: Some selected students have enrollment or evaluation records." : "Warning: This student has enrollment or evaluation records."}
      warningText={<>Deleting will <strong>cascade delete</strong> all records connected to {many ? "these students" : "this student"} — class enrollments and submitted evaluations (answers and comments). Faculty results that included these evaluations will change. This action cannot be undone.</>}
      unaffected="Classes, faculty, subjects and other students are not affected."
      warnOnEnrollments
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
