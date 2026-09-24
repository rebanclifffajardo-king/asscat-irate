"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveSubject } from "@/app/admin/surveys/actions";
import { EntityRowActions } from "../entity-actions";

type Subject = { id: string; code: string; title: string; description: string | null; units: number | null; is_active: boolean };

function SubjectModal({ onClose, subject }: { onClose: () => void; subject?: Subject }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(saveSubject, { onSuccess: onClose });
  return (
    <FormModal open onClose={onClose} title={subject ? "Edit Subject" : "Add Subject"} submitLabel={subject ? "Save" : "Add"}
      pending={pending} error={error} onSubmit={(v) => run({ ...v, id: subject?.id })}>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="Course Number" htmlFor="code" error={fe.code} required>
          <Input id="code" name="code" defaultValue={subject?.code} maxLength={30} className="uppercase" aria-describedby="code-msg" />
        </Field>
        <Field label="Descriptive Title" htmlFor="title" error={fe.title} required>
          <Input id="title" name="title" defaultValue={subject?.title} maxLength={200} aria-describedby="title-msg" />
        </Field>
      </div>
      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea id="description" name="description" defaultValue={subject?.description ?? ""} maxLength={1000} aria-describedby="description-msg" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Units" htmlFor="units" error={fe.units}>
          <Input id="units" name="units" type="number" step="0.5" min={0} max={12} defaultValue={subject?.units ?? ""} aria-describedby="units-msg" />
        </Field>
        <div className="flex items-end pb-2"><Checkbox name="is_active" label="Active" defaultChecked={subject?.is_active ?? true} /></div>
      </div>
    </FormModal>
  );
}

export function AddSubjectButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Subject</Button>
      {open && <SubjectModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function SubjectRowActions({ subject }: { subject: Subject }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      <EntityRowActions entity="subject" id={subject.id} name={`${subject.code} – ${subject.title}`} isActive={subject.is_active} onEdit={() => setEdit(true)} />
      {edit && <SubjectModal onClose={() => setEdit(false)} subject={subject} />}
    </>
  );
}
