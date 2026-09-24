"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveYearLevel } from "@/app/admin/settings/actions";
import { EntityRowActions } from "../entity-actions";

type YearLevel = { id: string; name: string; sort_order: number; is_active: boolean };

function YearLevelModal({ open, onClose, level, nextOrder }: { open: boolean; onClose: () => void; level?: YearLevel; nextOrder?: number }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(saveYearLevel, { onSuccess: onClose });
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={level ? "Edit Year Level" : "Add Year Level"}
      submitLabel={level ? "Save" : "Add"}
      pending={pending}
      error={error}
      size="sm"
      onSubmit={(v) => run({ ...v, id: level?.id })}
    >
      <Field label="Name" htmlFor="name" error={fe.name} required hint="e.g. 1st Year">
        <Input id="name" name="name" defaultValue={level?.name} maxLength={50} aria-describedby="name-msg" />
      </Field>
      <Field label="Sort Order" htmlFor="sort_order" error={fe.sort_order} required>
        <Input id="sort_order" name="sort_order" type="number" min={0} max={100} defaultValue={level?.sort_order ?? nextOrder ?? 1} aria-describedby="sort_order-msg" />
      </Field>
      <Checkbox name="is_active" label="Active" defaultChecked={level?.is_active ?? true} />
    </FormModal>
  );
}

export function AddYearLevelButton({ nextOrder }: { nextOrder: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Year Level</Button>
      <YearLevelModal open={open} onClose={() => setOpen(false)} nextOrder={nextOrder} />
    </>
  );
}

export function YearLevelRowActions({ level }: { level: YearLevel }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      <EntityRowActions entity="year_level" id={level.id} name={level.name} isActive={level.is_active} onEdit={() => setEdit(true)} />
      <YearLevelModal open={edit} onClose={() => setEdit(false)} level={level} />
    </>
  );
}
