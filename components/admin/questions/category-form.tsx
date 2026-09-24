"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveCategory } from "@/app/admin/questions/actions";
import { EntityRowActions } from "../entity-actions";

type Category = { id: string; name: string; description: string | null; sort_order: number; is_active: boolean };

function CategoryModal({ open, onClose, category, nextOrder }: { open: boolean; onClose: () => void; category?: Category; nextOrder?: number }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(saveCategory, { onSuccess: onClose });
  return (
    <FormModal open={open} onClose={onClose} title={category ? "Edit Category" : "Add Category"} submitLabel={category ? "Save" : "Create"}
      pending={pending} error={error} onSubmit={(v) => run({ ...v, id: category?.id })}>
      <Field label="Category Name" htmlFor="name" error={fe.name} required>
        <Input id="name" name="name" defaultValue={category?.name} maxLength={120} aria-describedby="name-msg" />
      </Field>
      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea id="description" name="description" defaultValue={category?.description ?? ""} maxLength={1000} aria-describedby="description-msg" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display Order" htmlFor="sort_order" error={fe.sort_order} hint="Order of the category on the evaluation form.">
          <Input id="sort_order" name="sort_order" type="number" min={0} max={1000} defaultValue={category?.sort_order ?? nextOrder ?? 1} aria-describedby="sort_order-msg" />
        </Field>
        <div className="flex items-end pb-2"><Checkbox name="is_active" label="Active" defaultChecked={category?.is_active ?? true} /></div>
      </div>
    </FormModal>
  );
}

export function AddCategoryButton({ nextOrder }: { nextOrder: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Category</Button>
      {open && <CategoryModal open onClose={() => setOpen(false)} nextOrder={nextOrder} />}
    </>
  );
}

export function CategoryRowActions({ category, questionCount }: { category: Category; questionCount: number }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      <EntityRowActions entity="category" id={category.id} name={category.name} isActive={category.is_active} onEdit={() => setEdit(true)} canDelete={questionCount === 0} />
      {edit && <CategoryModal open onClose={() => setEdit(false)} category={category} />}
    </>
  );
}
