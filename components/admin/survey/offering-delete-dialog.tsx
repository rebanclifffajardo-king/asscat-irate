"use client";

import { CascadeDeleteDialog } from "@/components/admin/cascade-delete-dialog";
import { getOfferingDeletionImpact } from "@/app/admin/surveys/actions";

/** Survey (class) delete: removes its enrollments and evaluations too. Mount only while open. */
export function OfferingDeleteDialog({ ids, name, onClose, onConfirm }: {
  ids: string[]; name?: string; onClose: () => void; onConfirm: (ids: string[]) => Promise<void>;
}) {
  return (
    <CascadeDeleteDialog
      ids={ids}
      title={ids.length === 1 ? "Delete this survey?" : `Delete ${ids.length} surveys?`}
      subject={name ? <strong>{name}</strong> : <><strong>{ids.length}</strong> selected subject(s)</>}
      loadImpact={getOfferingDeletionImpact}
      warningTitle="Warning: This survey already contains evaluation records."
      warningText="Deleting this survey will permanently delete all records connected to it, including submitted evaluations and related survey data. This action cannot be undone."
      unaffected="Students, faculty, subjects and other surveys are not affected."
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
