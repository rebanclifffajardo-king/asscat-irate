"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useServerAction, formValues } from "@/lib/hooks/use-server-action";
import { saveSystemSettings } from "@/app/admin/settings/actions";
import type { AppSettings } from "@/lib/data/lookups";

export function SystemSettingsForm({ settings }: { settings: AppSettings }) {
  const { run, pending, fieldErrors: fe } = useServerAction(saveSystemSettings);
  return (
    <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); run(formValues(e.currentTarget)); }} noValidate>
      <Field label="System name" htmlFor="system_name" error={fe.system_name} required>
        <Input id="system_name" name="system_name" defaultValue={settings.system_name} maxLength={80} aria-describedby="system_name-msg" />
      </Field>
      <Field label="Institution name" htmlFor="institution_name" error={fe.institution_name} required hint="Printed on report headers.">
        <Input id="institution_name" name="institution_name" defaultValue={settings.institution_name} maxLength={200} aria-describedby="institution_name-msg" />
      </Field>
      <Field label="Institution address" htmlFor="institution_address" error={fe.institution_address}>
        <Input id="institution_address" name="institution_address" defaultValue={settings.institution_address} maxLength={200} aria-describedby="institution_address-msg" />
      </Field>
      <Button type="submit" loading={pending}>{!pending && <Save className="h-4 w-4" />} Save system settings</Button>
    </form>
  );
}
