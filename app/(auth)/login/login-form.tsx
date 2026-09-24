"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && <Alert tone="warning">{notice}</Alert>}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email or ID Number" htmlFor="identifier" error={fe.identifier} required>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          placeholder="you@asscat.edu.ph or 2026-0001"
          autoFocus
          required
          aria-invalid={!!fe.identifier}
          aria-describedby="identifier-msg"
        />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password} required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={!!fe.password}
          aria-describedby="password-msg"
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Checkbox name="remember" label="Remember me" defaultChecked />
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending && <LogIn className="h-4 w-4" aria-hidden />} Log In
      </Button>
    </form>
  );
}
