import { z } from "zod";
import { checkbox, code, optionalText, requiredText, uuid } from "./common";

export const departmentSchema = z.object({
  code: code("Department code"),
  name: requiredText("Department name", 150),
  is_active: checkbox,
});

export const programSchema = z.object({
  code: code("Program code"),
  name: requiredText("Program name", 200),
  department_id: uuid("Department"),
  is_active: checkbox,
});

export const yearLevelSchema = z.object({
  name: requiredText("Name", 50),
  sort_order: z.coerce.number({ error: "Sort order must be a number." }).int().min(0).max(100),
  is_active: checkbox,
});

export const subjectSchema = z.object({
  code: code("Course number", 30),
  title: requiredText("Descriptive title", 200),
  description: optionalText(1000),
  units: z.union([z.literal(""), z.coerce.number().min(0).max(12)]).optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  is_active: checkbox,
});

export const categorySchema = z.object({
  name: requiredText("Category name", 120),
  description: optionalText(1000),
  sort_order: z.coerce.number().int().min(0).max(1000).default(0),
  is_active: checkbox,
});

export const questionSchema = z.object({
  title: requiredText("Question title", 120),
  content: requiredText("Question content", 1000),
  category_id: uuid("Category"),
  sort_order: z.coerce.number().int().min(0).max(1000).default(0),
  is_required: checkbox,
  is_active: checkbox,
});

const currentYear = new Date().getFullYear();

export const periodSchema = z.object({
  start_year: z.coerce.number({ error: "Select a school year." }).int().min(2006, "School year must be 2006 or later.")
    .max(currentYear + 5, "School year is too far in the future."),
  semester: z.coerce.number().int().refine((v) => v === 1 || v === 2, "Select a semester."),
  open_at: z.string().min(1, "Open date is required."),
  close_at: z.string().min(1, "Close date is required."),
  is_current: checkbox,
}).superRefine((v, ctx) => {
  const open = new Date(`${v.open_at}:00+08:00`);
  const close = new Date(`${v.close_at}:00+08:00`);
  if (Number.isNaN(open.getTime())) ctx.addIssue({ code: "custom", path: ["open_at"], message: "Open date is invalid." });
  if (Number.isNaN(close.getTime())) ctx.addIssue({ code: "custom", path: ["close_at"], message: "Close date is invalid." });
  if (!Number.isNaN(open.getTime()) && !Number.isNaN(close.getTime()) && close <= open) {
    ctx.addIssue({ code: "custom", path: ["close_at"], message: "Close date must be after the open date." });
  }
});

export const RESULTS_VISIBILITY = ["immediate", "after_close", "manual"] as const;

export const evaluationSettingsSchema = z.object({
  results_visibility: z.enum(RESULTS_VISIBILITY),
  min_respondents: z.coerce.number().int().min(1).max(50),
  allow_comments: checkbox,
  require_comments: checkbox,
  deadline_reminder_days: z.coerce.number().int().min(0).max(30),
  scale: z.array(z.object({ value: z.number().int().min(1).max(10), label: requiredText("Scale label", 40) }))
    .min(3, "The rating scale needs at least 3 points.").max(10)
    .refine((s) => s.every((p, i) => p.value === i + 1), "Scale values must be consecutive starting at 1."),
});

export const systemSettingsSchema = z.object({
  system_name: requiredText("System name", 80),
  institution_name: requiredText("Institution name", 200),
  institution_address: optionalText(200),
});
