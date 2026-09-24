import { z } from "zod";

export const requiredText = (label: string, max = 200) =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} is too long (max ${max}).`);

export const optionalText = (max = 200) =>
  z.string().trim().max(max, `Maximum ${max} characters.`).optional().transform((v) => (v ? v : null));

export const code = (label: string, max = 20) =>
  requiredText(label, max)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ._\-/&]*$/, `${label} may contain letters, numbers, spaces and . _ - / & only.`)
    .transform((v) => v.toUpperCase());

export const idNumber = (label: string) =>
  requiredText(label, 30).regex(/^[A-Za-z0-9][A-Za-z0-9\-_.]*$/, `${label} may contain letters, numbers, - _ . only.`)
    .transform((v) => v.toUpperCase());

export const email = z.email("Enter a valid email address.").trim().toLowerCase().max(254);

export const uuid = (label = "Selection") => z.uuid(`${label} is required.`);

export const checkbox = z.union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const isoDate = (label: string) =>
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`)
    .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), `${label} must be a valid date.`);

export const optionalIsoDate = (label: string) =>
  z.union([z.literal(""), isoDate(label)]).optional().transform((v) => (v ? v : null));

export const password = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");
