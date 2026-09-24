"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Field, Input, Select } from "@/components/ui/field";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { createOffering } from "@/app/admin/surveys/actions";

type Opt = { id: string; label: string };
type FacultyOpt = { id: string; label: string; program_id: string };

export function AddOfferingButton({ period, subjects, faculty, programs }: {
  period: { id: string; label: string } | null; subjects: Opt[]; faculty: FacultyOpt[]; programs: Opt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(subjects.length ? "existing" : "new");
  const [programId, setProgramId] = useState("");
  const { run, pending, fieldErrors: fe, error } = useServerAction(createOffering, {
    onSuccess: (d) => { setOpen(false); router.push(`/admin/surveys/${d.id}`); },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!period} title={period ? undefined : "Create a survey schedule first"}>
        <Plus className="h-4 w-4" /> Add Subject
      </Button>
      {open && period && (
        <FormModal
          open
          onClose={() => setOpen(false)}
          title="Add Subject"
          description={<>Assign a subject and teacher for <strong>{period.label}</strong>. Enroll students on the next screen.</>}
          submitLabel="Add Subject"
          pending={pending}
          error={error}
          size="lg"
          onSubmit={(v) => run({ ...v, academic_period_id: period.id, subject_mode: mode })}
        >
          <fieldset>
            <legend className="text-sm font-semibold text-gray-700">Subject</legend>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" className="accent-brand-500" checked={mode === "existing"} onChange={() => setMode("existing")} disabled={!subjects.length} /> Existing subject</label>
              <label className="flex items-center gap-2"><input type="radio" className="accent-brand-500" checked={mode === "new"} onChange={() => setMode("new")} /> New subject</label>
            </div>
          </fieldset>
          {mode === "existing" ? (
            <Field label="Subject" htmlFor="subject_id" error={fe.subject_id} required>
              <Select id="subject_id" name="subject_id" defaultValue="" aria-describedby="subject_id-msg">
                <option value="" disabled>Select subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label="Subject Code" htmlFor="new_subject_code" error={fe.new_subject_code} required>
                <Input id="new_subject_code" name="new_subject_code" maxLength={30} className="uppercase" aria-describedby="new_subject_code-msg" />
              </Field>
              <Field label="Subject Title" htmlFor="new_subject_title" error={fe.new_subject_title} required>
                <Input id="new_subject_title" name="new_subject_title" maxLength={200} aria-describedby="new_subject_title-msg" />
              </Field>
            </div>
          )}
          <Field label="Teacher" htmlFor="faculty_id" error={fe.faculty_id} required>
            <Select
              id="faculty_id"
              name="faculty_id"
              defaultValue=""
              onChange={(e) => { const f = faculty.find((x) => x.id === e.target.value); if (f && !programId) setProgramId(f.program_id); }}
              aria-describedby="faculty_id-msg"
            >
              <option value="" disabled>Select teacher…</option>
              {faculty.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Program" htmlFor="program_id" error={fe.program_id} required hint="The program the class is offered to.">
              <Select id="program_id" name="program_id" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-describedby="program_id-msg">
                <option value="" disabled>Select program…</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Section" htmlFor="section" error={fe.section} hint="Optional, e.g. A or BSIT-2A">
              <Input id="section" name="section" maxLength={30} className="uppercase" aria-describedby="section-msg" />
            </Field>
          </div>
        </FormModal>
      )}
    </>
  );
}
