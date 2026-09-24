"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, KeyRound, Pencil, Plus, Power, PowerOff, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { RowActions } from "@/components/ui/row-actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { createFaculty, deleteFaculty, resetFacultyPassword, setFacultyActive, updateFaculty } from "@/app/admin/faculty/actions";
import { TempPasswordDialog } from "./temp-password-dialog";

type Program = { id: string; code: string; name: string; department_id: string; department_code: string; department_name: string; is_active: boolean };
export type FacultyItem = {
  id: string; faculty_number: string; first_name: string; middle_name: string | null; last_name: string; email: string;
  birthday: string | null; date_started: string | null; program_id: string; photo_url: string | null; is_active: boolean; full_name: string;
};

function FacultyModal({ open, onClose, faculty, programs, onCreated }: {
  open: boolean; onClose: () => void; faculty?: FacultyItem; programs: Program[]; onCreated?: (r: { tempPassword: string; email: string }) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fe, setFe] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [programId, setProgramId] = useState(faculty?.program_id ?? "");
  const [preview, setPreview] = useState<string | null>(faculty?.photo_url ?? null);
  const program = useMemo(() => programs.find((p) => p.id === programId), [programs, programId]);
  const today = new Date().toISOString().slice(0, 10);

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    if (faculty) fd.set("id", faculty.id);
    startTransition(async () => {
      const res = faculty ? await updateFaculty(fd) : await createFaculty(fd);
      if (res.ok) {
        toast.success(res.message);
        onClose();
        router.refresh();
        if (!faculty && res.data) onCreated?.(res.data as { tempPassword: string; email: string });
      } else {
        setFe(res.fieldErrors ?? {});
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={pending}
      size="lg"
      title={faculty ? "Edit Faculty" : "Add Faculty"}
      description={faculty ? undefined : "A login account is created with a temporary password."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form="faculty-form" loading={pending}>{faculty ? "Save" : "Add"}</Button>
        </>
      }
    >
      <form id="faculty-form" noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!pending) submit(e.currentTarget); }}>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex items-center gap-4">
          <FacultyAvatar name={faculty?.full_name ?? "New Faculty"} src={preview} size="lg" className="ring-gray-200" />
          <div className="space-y-1">
            <label htmlFor="photo" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Upload className="h-4 w-4" /> {preview ? "Change photo" : "Upload photo"}
            </label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) { toast.error("Photo must be 2 MB or smaller."); e.target.value = ""; return; }
                setPreview(URL.createObjectURL(f));
              }}
            />
            <p className="text-xs text-gray-500">JPG, PNG or WebP, up to 2 MB.</p>
            {fe.photo && <p className="text-xs font-medium text-lte-danger">{fe.photo[0]}</p>}
            {faculty?.photo_url && <Checkbox name="remove_photo" label="Remove current photo" />}
          </div>
        </div>
        <Field label="Faculty ID" htmlFor="faculty_number" error={fe.faculty_number} required hint="e.g. FAC-0013">
          <Input id="faculty_number" name="faculty_number" defaultValue={faculty?.faculty_number} maxLength={30} className="uppercase" aria-describedby="faculty_number-msg" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First Name" htmlFor="first_name" error={fe.first_name} required>
            <Input id="first_name" name="first_name" defaultValue={faculty?.first_name} maxLength={100} aria-describedby="first_name-msg" />
          </Field>
          <Field label="Middle Name" htmlFor="middle_name" error={fe.middle_name}>
            <Input id="middle_name" name="middle_name" defaultValue={faculty?.middle_name ?? ""} maxLength={100} aria-describedby="middle_name-msg" />
          </Field>
          <Field label="Last Name" htmlFor="last_name" error={fe.last_name} required>
            <Input id="last_name" name="last_name" defaultValue={faculty?.last_name} maxLength={100} aria-describedby="last_name-msg" />
          </Field>
        </div>
        <Field label="Email Address" htmlFor="email" error={fe.email} required>
          <Input id="email" name="email" type="email" defaultValue={faculty?.email} maxLength={254} aria-describedby="email-msg" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Birthday" htmlFor="birthday" error={fe.birthday} hint="Used to compute age for analytics (never stored as age).">
            <Input id="birthday" name="birthday" type="date" max={today} defaultValue={faculty?.birthday ?? ""} aria-describedby="birthday-msg" />
          </Field>
          <Field label="Date Started" htmlFor="date_started" error={fe.date_started} hint="Used to compute years of service.">
            <Input id="date_started" name="date_started" type="date" max={today} defaultValue={faculty?.date_started ?? ""} aria-describedby="date_started-msg" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Program" htmlFor="program_id" error={fe.program_id} required>
            <Select id="program_id" name="program_id" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-describedby="program_id-msg">
              <option value="" disabled>Select program…</option>
              {programs.filter((p) => p.is_active || p.id === faculty?.program_id).map((p) => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Department" htmlFor="department" hint="Determined automatically from the program.">
            <Input id="department" value={program ? `${program.department_code} – ${program.department_name}` : ""} placeholder="Select a program first" readOnly disabled aria-describedby="department-msg" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function AddFacultyButton({ programs }: { programs: Program[] }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ tempPassword: string; email: string } | null>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Faculty</Button>
      {open && <FacultyModal open onClose={() => setOpen(false)} programs={programs} onCreated={setCreated} />}
      {created && <TempPasswordDialog open onClose={() => setCreated(null)} email={created.email} password={created.tempPassword} title="Faculty account created" />}
    </>
  );
}

export function FacultyRowActions({ faculty, programs }: { faculty: FacultyItem; programs: Program[] }) {
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
        label={`Actions for ${faculty.full_name}`}
        items={[
          { label: "View", icon: <Eye className="h-4 w-4" />, onSelect: () => router.push(`/admin/faculty/${faculty.id}`) },
          { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEdit(true) },
          { label: "Reset Password", icon: <KeyRound className="h-4 w-4" />, onSelect: () => setConfirm("reset") },
          { label: faculty.is_active ? "Deactivate" : "Activate", icon: faculty.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />, onSelect: () => setConfirm("toggle") },
          { type: "separator" },
          { label: "Delete", icon: <Trash2 className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm("delete") },
        ]}
      />
      {edit && <FacultyModal open onClose={() => setEdit(false)} faculty={faculty} programs={programs} />}
      <ConfirmationDialog open={confirm === "toggle"} onClose={() => setConfirm(null)} tone={faculty.is_active ? "warning" : "primary"}
        title={faculty.is_active ? "Deactivate faculty?" : "Activate faculty?"}
        message={faculty.is_active
          ? <><strong>{faculty.full_name}</strong> will no longer be able to sign in. Classes and evaluation history are preserved.</>
          : <>Restore sign-in access for <strong>{faculty.full_name}</strong>?</>}
        confirmLabel={faculty.is_active ? "Deactivate" : "Activate"}
        onConfirm={async () => done(await setFacultyActive({ id: faculty.id, active: !faculty.is_active }))} />
      <ConfirmationDialog open={confirm === "reset"} onClose={() => setConfirm(null)} tone="warning" title="Reset password?"
        message={<>Generate a new temporary password for <strong>{faculty.full_name}</strong>?</>}
        confirmLabel="Reset password"
        onConfirm={async () => {
          const res = await resetFacultyPassword(faculty.id);
          if (res.ok) { setConfirm(null); setTemp(res.data.tempPassword); } else toast.error(res.error);
        }} />
      <ConfirmationDialog open={confirm === "delete"} onClose={() => setConfirm(null)} title="Delete faculty?"
        message={<>Permanently delete <strong>{faculty.full_name}</strong> and their login account? Faculty with assigned classes cannot be deleted — deactivate instead.</>}
        confirmLabel="Delete" onConfirm={async () => done(await deleteFaculty(faculty.id))} />
      {temp && <TempPasswordDialog open onClose={() => setTemp(null)} email={faculty.email} password={temp} title="Password reset" />}
    </>
  );
}
