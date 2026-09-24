"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveDepartment } from "@/app/admin/settings/actions";
import { EntityRowActions } from "../entity-actions";

type Dept = { id: string; code: string; name: string; is_active: boolean };

function DepartmentModal({ open, onClose, dept }: { open: boolean; onClose: () => void; dept?: Dept }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(saveDepartment, { onSuccess: onClose });
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={dept ? "Edit Department" : "Add Department"}
      submitLabel={dept ? "Save" : "Add"}
      pending={pending}
      error={error}
      onSubmit={(v) => run({ ...v, id: dept?.id })}
    >
      <Field label="Department Code" htmlFor="code" error={fe.code} required hint="e.g. CEIT">
        <Input id="code" name="code" defaultValue={dept?.code} maxLength={20} className="uppercase" aria-describedby="code-msg" />
      </Field>
      <Field label="Department Name" htmlFor="name" error={fe.name} required>
        <Input id="name" name="name" defaultValue={dept?.name} maxLength={150} aria-describedby="name-msg" />
      </Field>
      <Checkbox name="is_active" label="Active" defaultChecked={dept?.is_active ?? true} />
    </FormModal>
  );
}

export function AddDepartmentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Department</Button>
      <DepartmentModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function DepartmentRowActions({ dept }: { dept: Dept }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      <EntityRowActions entity="department" id={dept.id} name={`${dept.code} – ${dept.name}`} isActive={dept.is_active} onEdit={() => setEdit(true)} />
      <DepartmentModal open={edit} onClose={() => setEdit(false)} dept={dept} />
    </>
  );
}
