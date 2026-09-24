"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";
import { FormModal } from "@/components/ui/form-modal";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { deleteOffering, updateOffering } from "@/app/admin/surveys/actions";
import { OfferingDeleteDialog } from "./offering-delete-dialog";

type FacultyOpt = { id: string; label: string };
type Offering = { id: string; name: string; completed: number; faculty_id: string; faculty_name: string; section: string };

function EditOfferingModal({ offering, faculty, onClose }: { offering: Offering; faculty: FacultyOpt[]; onClose: () => void }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(updateOffering, { onSuccess: onClose });
  // An inactive current instructor is not in the active list; keep it selectable.
  const options = faculty.some((f) => f.id === offering.faculty_id)
    ? faculty
    : [{ id: offering.faculty_id, label: `${offering.faculty_name} (inactive)` }, ...faculty];
  return (
    <FormModal
      open
      onClose={onClose}
      title="Edit Subject Offering"
      description={offering.name}
      submitLabel="Save"
      pending={pending}
      error={error}
      onSubmit={(v) => run({ ...v, id: offering.id })}
    >
      {offering.completed > 0 && (
        <Alert tone="warning" title={`${offering.completed} submitted evaluation(s)`}>
          Existing responses stay attached to this offering. If you change the instructor, those responses will count toward the newly assigned instructor&apos;s results.
        </Alert>
      )}
      <Field label="Instructor" htmlFor="faculty_id" error={fe.faculty_id} required>
        <Select id="faculty_id" name="faculty_id" defaultValue={offering.faculty_id} aria-describedby="faculty_id-msg">
          {options.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </Select>
      </Field>
      <Field label="Section" htmlFor="section" error={fe.section} hint="Optional, e.g. A or BSIT-2A">
        <Input id="section" name="section" defaultValue={offering.section} maxLength={30} className="uppercase" aria-describedby="section-msg" />
      </Field>
    </FormModal>
  );
}

export function OfferingRowActions({ offering, faculty }: { offering: Offering; faculty: FacultyOpt[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState(false);
  const { id, name } = offering;
  return (
    <>
      <RowActions
        label={`Actions for ${name}`}
        items={[
          { label: "View", icon: <Eye className="h-4 w-4" />, onSelect: () => router.push(`/admin/surveys/${id}`) },
          { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEdit(true) },
          { type: "separator" },
          { label: "Delete", icon: <Trash2 className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm(true) },
        ]}
      />
      {edit && <EditOfferingModal offering={offering} faculty={faculty} onClose={() => setEdit(false)} />}
      {confirm && (
        <OfferingDeleteDialog ids={[id]} name={name} onClose={() => setConfirm(false)}
          onConfirm={async ([oid]) => {
            const res = await deleteOffering(oid);
            if (res.ok) { toast.success(res.message); setConfirm(false); router.refresh(); } else toast.error(res.error);
          }} />
      )}
    </>
  );
}
