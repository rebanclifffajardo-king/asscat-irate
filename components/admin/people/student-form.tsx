"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, KeyRound, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Field, Input, Select } from "@/components/ui/field";
import { RowActions } from "@/components/ui/row-actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { createStudent, deleteStudent, resetStudentPassword, setStudentActive, updateStudent } from "@/app/admin/students/actions";
import { TempPasswordDialog } from "./temp-password-dialog";
import { StudentDeleteDialog } from "./student-delete-dialog";

type Option = { id: string; code?: string; name: string; is_active: boolean };
export type StudentItem = {
  id: string; student_number: string; first_name: string; middle_name: string | null; last_name: string;
  email: string; program_id: string; year_level_id: string; is_active: boolean; full_name: string;
};

function StudentModal({ open, onClose, student, programs, yearLevels, onCreated }: {
  open: boolean; onClose: () => void; student?: StudentItem; programs: Option[]; yearLevels: Option[];
  onCreated?: (r: { tempPassword: string; email: string }) => void;
}) {
  const create = useServerAction(createStudent, { onSuccess: (d) => { onClose(); onCreated?.(d); } });
  const update = useServerAction(updateStudent, { onSuccess: onClose });
  const { pending, fieldErrors: fe, error } = student ? update : create;
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={student ? "Edit Student" : "Add Student"}
      description={student ? undefined : "A login account is created with a temporary password."}
      submitLabel={student ? "Save" : "Add"}
      pending={pending}
      error={error}
      size="lg"
      onSubmit={(v) => (student ? update.run({ ...v, id: student.id }) : create.run(v))}
    >
      <Field label="Student ID" htmlFor="student_number" error={fe.student_number} required hint="e.g. 2026-0001">
        <Input id="student_number" name="student_number" defaultValue={student?.student_number} maxLength={30} className="uppercase" aria-describedby="student_number-msg" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First Name" htmlFor="first_name" error={fe.first_name} required>
          <Input id="first_name" name="first_name" defaultValue={student?.first_name} maxLength={100} autoComplete="off" aria-describedby="first_name-msg" />
        </Field>
        <Field label="Middle Name" htmlFor="middle_name" error={fe.middle_name}>
          <Input id="middle_name" name="middle_name" defaultValue={student?.middle_name ?? ""} maxLength={100} autoComplete="off" aria-describedby="middle_name-msg" />
        </Field>
        <Field label="Last Name" htmlFor="last_name" error={fe.last_name} required>
          <Input id="last_name" name="last_name" defaultValue={student?.last_name} maxLength={100} autoComplete="off" aria-describedby="last_name-msg" />
        </Field>
      </div>
      <Field label="Email Address" htmlFor="email" error={fe.email} required>
        <Input id="email" name="email" type="email" defaultValue={student?.email} maxLength={254} autoComplete="off" aria-describedby="email-msg" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Program" htmlFor="program_id" error={fe.program_id} required>
          <Select id="program_id" name="program_id" defaultValue={student?.program_id ?? ""} aria-describedby="program_id-msg">
            <option value="" disabled>Select program…</option>
            {programs.filter((p) => p.is_active || p.id === student?.program_id).map((p) => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
          </Select>
        </Field>
        <Field label="Year Level" htmlFor="year_level_id" error={fe.year_level_id} required>
          <Select id="year_level_id" name="year_level_id" defaultValue={student?.year_level_id ?? ""} aria-describedby="year_level_id-msg">
            <option value="" disabled>Select year level…</option>
            {yearLevels.filter((y) => y.is_active || y.id === student?.year_level_id).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
      </div>
    </FormModal>
  );
}

export function AddStudentButton({ programs, yearLevels }: { programs: Option[]; yearLevels: Option[] }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ tempPassword: string; email: string } | null>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Student</Button>
      {open && <StudentModal open onClose={() => setOpen(false)} programs={programs} yearLevels={yearLevels} onCreated={setCreated} />}
      {created && <TempPasswordDialog open onClose={() => setCreated(null)} email={created.email} password={created.tempPassword} title="Student account created" />}
    </>
  );
}

export function StudentRowActions({ student, programs, yearLevels }: { student: StudentItem; programs: Option[]; yearLevels: Option[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<null | "toggle" | "delete" | "reset">(null);
  const [temp, setTemp] = useState<string | null>(null);
  const done = (res: { ok: boolean; message?: string; error?: string }) => {
    if (res.ok) { toast.success(res.message); setConfirm(null); router.refresh(); } else toast.error(res.error);
  };
  return (
    <>
      <RowActions
        label={`Actions for ${student.full_name}`}
        items={[
          { label: "View", icon: <Eye className="h-4 w-4" />, onSelect: () => router.push(`/admin/students/${student.id}`) },
          { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEdit(true) },
          { label: "Reset Password", icon: <KeyRound className="h-4 w-4" />, onSelect: () => setConfirm("reset") },
          { label: student.is_active ? "Deactivate" : "Activate", icon: student.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />, onSelect: () => setConfirm("toggle") },
          { type: "separator" },
          { label: "Delete", icon: <Trash2 className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm("delete") },
        ]}
      />
      {edit && <StudentModal open onClose={() => setEdit(false)} student={student} programs={programs} yearLevels={yearLevels} />}
      <ConfirmationDialog open={confirm === "toggle"} onClose={() => setConfirm(null)} tone={student.is_active ? "warning" : "primary"}
        title={student.is_active ? "Deactivate student?" : "Activate student?"}
        message={student.is_active
          ? <><strong>{student.full_name}</strong> will no longer be able to sign in. Evaluation history is preserved.</>
          : <>Restore sign-in access for <strong>{student.full_name}</strong>?</>}
        confirmLabel={student.is_active ? "Deactivate" : "Activate"}
        onConfirm={async () => done(await setStudentActive({ id: student.id, active: !student.is_active }))} />
      <ConfirmationDialog open={confirm === "reset"} onClose={() => setConfirm(null)} tone="warning" title="Reset password?"
        message={<>Generate a new temporary password for <strong>{student.full_name}</strong>? The current password stops working immediately.</>}
        confirmLabel="Reset password"
        onConfirm={async () => {
          const res = await resetStudentPassword(student.id);
          if (res.ok) { setConfirm(null); setTemp(res.data.tempPassword); } else toast.error(res.error);
        }} />
      {confirm === "delete" && (
        <StudentDeleteDialog ids={[student.id]} name={student.full_name} onClose={() => setConfirm(null)}
          onConfirm={async ([id]) => done(await deleteStudent(id))} />
      )}
      {temp && <TempPasswordDialog open onClose={() => setTemp(null)} email={student.email} password={temp} title="Password reset" />}
    </>
  );
}

export function StudentLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/admin/students/${id}`} className="hover:text-brand-600 hover:underline">{children}</Link>;
}
