"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import type { FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  requireCurrent?: boolean;
  mode?: "forced" | "voluntary" | "reset";
  submitLabel?: string;
};

/** Shared password form (forced change, voluntary change, email reset). */
export function PasswordForm({ action, requireCurrent = true, mode = "voluntary", submitLabel = "Change password" }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="mode" value={mode} />
      {requireCurrent && (
        <Field label="Current password" htmlFor="current" error={fe.current} required>
          <PasswordInput id="current" name="current" autoComplete="current-password" aria-describedby="current-msg" aria-invalid={!!fe.current} />
        </Field>
      )}
      <Field
        label="New password"
        htmlFor="password"
        error={fe.password}
        hint="At least 8 characters with uppercase, lowercase and a number."
        required
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" aria-describedby="password-msg" aria-invalid={!!fe.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm} required>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" aria-describedby="confirm-msg" aria-invalid={!!fe.confirm} />
      </Field>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        {!pending && <KeyRound className="h-4 w-4" aria-hidden />} {submitLabel}
      </Button>
    </form>
  );
}
