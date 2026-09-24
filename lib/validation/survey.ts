import { z } from "zod";
import { code, optionalText, requiredText, uuid } from "./common";

export const offeringSchema = z.object({
  academic_period_id: uuid("School year / semester"),
  subject_mode: z.enum(["existing", "new"]),
  subject_id: z.string().optional(),
  new_subject_code: z.string().optional(),
  new_subject_title: z.string().optional(),
  faculty_id: uuid("Teacher"),
  program_id: uuid("Program"),
  section: optionalText(30).transform((v) => (v ?? "").toUpperCase()),
}).superRefine((v, ctx) => {
  if (v.subject_mode === "existing") {
    if (!v.subject_id || !z.uuid().safeParse(v.subject_id).success) {
      ctx.addIssue({ code: "custom", path: ["subject_id"], message: "Select a subject." });
    }
  } else {
    const c = code("Subject code", 30).safeParse(v.new_subject_code ?? "");
    if (!c.success) ctx.addIssue({ code: "custom", path: ["new_subject_code"], message: c.error.issues[0].message });
    const t = requiredText("Subject title", 200).safeParse(v.new_subject_title ?? "");
    if (!t.success) ctx.addIssue({ code: "custom", path: ["new_subject_title"], message: t.error.issues[0].message });
  }
});

export const enrollSchema = z.object({
  offering_id: uuid("Class"),
  student_ids: z.array(z.uuid()).min(1, "Select at least one student.").max(500),
});

export const evaluationPayloadSchema = z.object({
  offering_id: uuid("Evaluation"),
  answers: z.record(z.uuid(), z.number().int().min(1).max(10)),
  comment: z.string().max(3000, "Comment is too long (maximum 3000 characters).").optional().nullable(),
});
