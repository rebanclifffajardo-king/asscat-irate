import "server-only";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/session";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** An error whose message is safe to show to the user. */
export class UserFacingError extends Error {
  fieldErrors?: FieldErrors;
  constructor(message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "UserFacingError";
    this.fieldErrors = fieldErrors;
  }
}

type PgLikeError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/** Friendly messages for constraint violations raised by PostgreSQL / RLS. */
export function dbError(error: PgLikeError, context: { unique?: string; foreignKey?: string } = {}): UserFacingError {
  switch (error.code) {
    case "23505":
      return new UserFacingError(context.unique ?? "A record with the same unique value already exists.");
    case "23503":
      return new UserFacingError(
        context.foreignKey ??
          (error.message?.startsWith("Row ") || error.message?.includes("not found")
            ? error.message
            : "This record is referenced by other records and cannot be removed. Deactivate it instead."),
      );
    case "23514":
      return new UserFacingError(error.message?.includes("violates check constraint") ? "One or more values are invalid." : (error.message ?? "Invalid value."));
    case "22001":
    case "22023":
    case "P0001":
    case "P0002":
      return new UserFacingError(error.message ?? "The request could not be completed.");
    case "42501":
      return new UserFacingError("You are not authorized to perform this action.");
    default:
      console.error("[db]", error);
      return new UserFacingError("Something went wrong while saving. Please try again.");
  }
}

export function validationError(error: z.ZodError): UserFacingError {
  const flat = z.flattenError(error);
  return new UserFacingError(flat.formErrors[0] ?? "Please correct the highlighted fields.", flat.fieldErrors as FieldErrors);
}

/** Parse input with a zod schema or throw a field-level UserFacingError. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const res = schema.safeParse(input);
  if (!res.success) throw validationError(res.error);
  return res.data;
}

/** Runs a server action body and converts thrown errors into ActionResult. */
export async function runAction<T>(fn: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (e) {
    // Let Next.js redirect()/notFound() propagate.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" &&
        ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") || (e as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR"))) {
      throw e;
    }
    if (e instanceof UserFacingError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

/** FormData → plain object (checkbox "on" → true; empty strings kept). */
export function formToObject(formData: FormData): Record<string, FormDataEntryValue | boolean> {
  const obj: Record<string, FormDataEntryValue | boolean> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("$ACTION")) continue;
    obj[k] = v === "on" ? true : v;
  }
  return obj;
}
