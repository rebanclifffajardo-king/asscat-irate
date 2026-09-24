"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { saveQuestion } from "@/app/admin/questions/actions";
import { EntityRowActions } from "../entity-actions";

type Question = { id: string; title: string; content: string; category_id: string; sort_order: number; is_required: boolean; is_active: boolean; is_used: boolean };
type Category = { id: string; name: string; is_active: boolean };

function QuestionModal({ open, onClose, question, categories }: { open: boolean; onClose: () => void; question?: Question; categories: Category[] }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(saveQuestion, { onSuccess: onClose });
  const options = categories.filter((c) => c.is_active || c.id === question?.category_id);
  return (
    <FormModal open={open} onClose={onClose} title={question ? "Edit Question" : "Add Question"} submitLabel={question ? "Save" : "Create"}
      pending={pending} error={error} size="lg" onSubmit={(v) => run({ ...v, id: question?.id })}>
      {question?.is_used && (
        <Alert tone="info">This question has been answered before. Past evaluations keep the original wording; changes apply to new evaluations only.</Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="Question Title" htmlFor="title" error={fe.title} required hint="Short code, e.g. TC-1">
          <Input id="title" name="title" defaultValue={question?.title} maxLength={120} aria-describedby="title-msg" />
        </Field>
        <Field label="Category" htmlFor="category_id" error={fe.category_id} required>
          <Select id="category_id" name="category_id" defaultValue={question?.category_id ?? ""} aria-describedby="category_id-msg">
            <option value="" disabled>Select category…</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Question Content" htmlFor="content" error={fe.content} required>
        <Textarea id="content" name="content" defaultValue={question?.content} maxLength={1000} rows={3} aria-describedby="content-msg" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Display Order" htmlFor="sort_order" error={fe.sort_order}>
          <Input id="sort_order" name="sort_order" type="number" min={0} max={1000} defaultValue={question?.sort_order ?? 0} aria-describedby="sort_order-msg" />
        </Field>
        <div className="flex items-end pb-2"><Checkbox name="is_required" label="Required" defaultChecked={question?.is_required ?? true} /></div>
        <div className="flex items-end pb-2"><Checkbox name="is_active" label="Active" defaultChecked={question?.is_active ?? true} /></div>
      </div>
    </FormModal>
  );
}

export function AddQuestionButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Question</Button>
      {open && <QuestionModal open onClose={() => setOpen(false)} categories={categories} />}
    </>
  );
}

export function QuestionRowActions({ question, categories }: { question: Question; categories: Category[] }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      <EntityRowActions entity="question" id={question.id} name={question.title} isActive={question.is_active} onEdit={() => setEdit(true)} canDelete={!question.is_used} />
      {edit && <QuestionModal open onClose={() => setEdit(false)} question={question} categories={categories} />}
    </>
  );
}
