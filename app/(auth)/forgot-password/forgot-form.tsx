"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Email or ID Number" htmlFor="identifier" error={state?.fieldErrors?.identifier} required>
        <Input id="identifier" name="identifier" autoComplete="username" required aria-describedby="identifier-msg" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending && <Mail className="h-4 w-4" aria-hidden />} Send reset link
      </Button>
      <Link href="/login" className="flex items-center justify-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to login
      </Link>
    </form>
  );
}
