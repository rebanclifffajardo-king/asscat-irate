"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveProgram } from "@/app/admin/settings/actions";
import { EntityRowActions } from "../entity-actions";

type Program = { id: string; code: string; name: string; department_id: string; is_active: boolean };
type Dept = { id: string; code: string; name: string; is_active: boolean };

function ProgramModal({ open, onClose, program, departments }: { open: boolean; onClose: () => void; program?: Program; departments: Dept[] }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(saveProgram, { onSuccess: onClose });
  const options = departments.filter((d) => d.is_active || d.id === program?.department_id);
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={program ? "Edit Program" : "Add Program"}
      submitLabel={program ? "Save" : "Add"}
      pending={pending}
      error={error}
      onSubmit={(v) => run({ ...v, id: program?.id })}
    >
      <Field label="Program Code" htmlFor="code" error={fe.code} required hint="e.g. BSIT">
        <Input id="code" name="code" defaultValue={program?.code} maxLength={20} className="uppercase" aria-describedby="code-msg" />
      </Field>
      <Field label="Program Name" htmlFor="name" error={fe.name} required hint="e.g. Bachelor of Science in Information Technology">
        <Input id="name" name="name" defaultValue={program?.name} maxLength={200} aria-describedby="name-msg" />
      </Field>
      <Field label="Department" htmlFor="department_id" error={fe.department_id} required>
        <Select id="department_id" name="department_id" defaultValue={program?.department_id ?? ""} aria-describedby="department_id-msg">
          <option value="" disabled>Select department…</option>
          {options.map((d) => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
        </Select>
      </Field>
      <Checkbox name="is_active" label="Active" defaultChecked={program?.is_active ?? true} />
    </FormModal>
  );
}

export function AddProgramButton({ departments }: { departments: Dept[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Program</Button>
      <ProgramModal open={open} onClose={() => setOpen(false)} departments={departments} />
    </>
  );
}

export function ProgramRowActions({ program, departments }: { program: Program; departments: Dept[] }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      <EntityRowActions entity="program" id={program.id} name={`${program.code} – ${program.name}`} isActive={program.is_active} onEdit={() => setEdit(true)} />
      <ProgramModal open={edit} onClose={() => setEdit(false)} program={program} departments={departments} />
    </>
  );
}
