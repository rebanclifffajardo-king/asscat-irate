"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * Calls a server action with pending state, toast feedback and field errors.
 * Guards against double submission while pending.
 */
export function useServerAction<I, T>(
  action: (input: I) => Promise<Result<T>>,
  opts: { onSuccess?: (data: T, message?: string) => void; successMessage?: string; silent?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (input: I) =>
      new Promise<Result<T>>((resolve) => {
        if (pending) return;
        startTransition(async () => {
          const res = await action(input);
          if (res.ok) {
            setFieldErrors({});
            setError(null);
            const msg = res.message ?? opts.successMessage;
            if (msg && !opts.silent) toast.success(msg);
            opts.onSuccess?.(res.data, res.message);
          } else {
            setFieldErrors(res.fieldErrors ?? {});
            setError(res.error);
            toast.error(res.error);
          }
          resolve(res);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, pending],
  );

  const reset = useCallback(() => { setFieldErrors({}); setError(null); }, []);
  return { run, pending, fieldErrors, error, reset };
}

/** Collects a form into a plain object (unchecked checkboxes become false). */
export function formValues(form: HTMLFormElement): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
    else if (el.type !== "file" && el.type !== "submit" && el.type !== "button") out[el.name] = el.value;
  }
  return out;
}
