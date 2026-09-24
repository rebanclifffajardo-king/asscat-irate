"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { RowActions } from "@/components/ui/row-actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { MenuItem } from "@/components/ui/dropdown-menu";
import { useServerAction } from "@/lib/hooks/use-server-action";
import { deletePeriod, releaseResults, savePeriod, setCurrentPeriod } from "@/app/admin/settings/actions";
import { toDateTimeLocal } from "@/lib/format";

export type PeriodItem = {
  id: string; label: string; start_year: number; semester: number; open_at: string; close_at: string;
  is_current: boolean; results_released_at: string | null; status: string;
};

/** 2006 through next year; extends automatically every year. */
function yearOptions() {
  const last = new Date().getFullYear() + 1;
  return Array.from({ length: last - 2006 + 1 }, (_, i) => last - i);
}

function PeriodModal({ open, onClose, period }: { open: boolean; onClose: () => void; period?: PeriodItem }) {
  const { run, pending, fieldErrors: fe, error } = useServerAction(savePeriod, { onSuccess: onClose });
  const [startYear, setStartYear] = useState<number>(period?.start_year ?? new Date().getFullYear());
  const [openAt, setOpenAt] = useState(toDateTimeLocal(period?.open_at));
  const [closeAt, setCloseAt] = useState(toDateTimeLocal(period?.close_at));
  const rangeError = openAt && closeAt && closeAt <= openAt ? "Close date must be after the open date." : undefined;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={period ? "Edit Survey Schedule" : "Add Survey Schedule"}
      description="Each school year and semester is a separate evaluation period."
      submitLabel={period ? "Save" : "Create"}
      pending={pending}
      error={error}
      onSubmit={(v) => {
        if (rangeError) return toast.error(rangeError);
        run({ ...v, id: period?.id });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start Year" htmlFor="start_year" error={fe.start_year} required hint={`Creates S.Y. ${startYear}-${startYear + 1}`}>
          <Select id="start_year" name="start_year" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} aria-describedby="start_year-msg">
            {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
        <Field label="Semester" htmlFor="semester" error={fe.semester} required>
          <Select id="semester" name="semester" defaultValue={period?.semester ?? 1} aria-describedby="semester-msg">
            <option value={1}>1st Semester</option>
            <option value={2}>2nd Semester</option>
          </Select>
        </Field>
        <Field label="Open Date" htmlFor="open_at" error={fe.open_at} required hint="Philippine time">
          <Input id="open_at" name="open_at" type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} aria-describedby="open_at-msg" />
        </Field>
        <Field label="Close Date" htmlFor="close_at" error={fe.close_at ?? rangeError} required>
          <Input id="close_at" name="close_at" type="datetime-local" value={closeAt} min={openAt || undefined} onChange={(e) => setCloseAt(e.target.value)} aria-invalid={!!rangeError} aria-describedby="close_at-msg" />
        </Field>
      </div>
      <Checkbox name="is_current" label="Set as the active (default) evaluation period" defaultChecked={period?.is_current ?? false} />
    </FormModal>
  );
}

export function AddPeriodButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Schedule</Button>
      {open && <PeriodModal open onClose={() => setOpen(false)} />}
    </>
  );
}

export function PeriodRowActions({ period, visibility }: { period: PeriodItem; visibility: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "active" | "release">(null);
  const released = !!period.results_released_at;

  const done = (res: { ok: boolean; message?: string; error?: string }) => {
    if (res.ok) { toast.success(res.message); setConfirm(null); router.refresh(); } else toast.error(res.error);
  };

  const items: MenuItem[] = [
    { label: "Set as Active", icon: <CheckCircle2 className="h-4 w-4" />, disabled: period.is_current, onSelect: () => setConfirm("active") },
    { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEdit(true) },
    ...(visibility !== "immediate"
      ? [{ label: released ? "Withdraw Results" : "Release Results", icon: released ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />, onSelect: () => setConfirm("release") }]
      : []),
    { type: "separator" },
    { label: "Delete", icon: <Trash2 className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm("delete") },
  ];

  return (
    <>
      <RowActions items={items} label={`Actions for ${period.label}`} />
      {edit && <PeriodModal open onClose={() => setEdit(false)} period={period} />}
      <ConfirmationDialog
        open={confirm === "active"}
        onClose={() => setConfirm(null)}
        tone="primary"
        title="Set as active period?"
        message={<>Make <strong>{period.label}</strong> the default evaluation period across surveys, dashboards and reports?</>}
        confirmLabel="Set as Active"
        onConfirm={async () => done(await setCurrentPeriod(period.id))}
      />
      <ConfirmationDialog
        open={confirm === "release"}
        onClose={() => setConfirm(null)}
        tone={released ? "warning" : "primary"}
        title={released ? "Withdraw results?" : "Release results to faculty?"}
        message={released
          ? <>Faculty will no longer be able to view their results for <strong>{period.label}</strong> (unless the survey has closed and visibility is &ldquo;after close&rdquo;).</>
          : <>Faculty will be able to view their aggregate, anonymous results for <strong>{period.label}</strong> and will be notified.</>}
        confirmLabel={released ? "Withdraw" : "Release"}
        onConfirm={async () => done(await releaseResults({ periodId: period.id, release: !released }))}
      />
      <ConfirmationDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete schedule?"
        message={<>Delete <strong>{period.label}</strong>? Schedules that already have classes or evaluations cannot be deleted.</>}
        confirmLabel="Delete"
        onConfirm={async () => done(await deletePeriod(period.id))}
      />
    </>
  );
}
