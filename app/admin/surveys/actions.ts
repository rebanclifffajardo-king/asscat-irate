"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { enrollSchema, offeringSchema } from "@/lib/validation/survey";
import { subjectSchema } from "@/lib/validation/master";
import { likePattern } from "@/lib/url";

export async function createOffering(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(offeringSchema, raw);
    const supabase = await createClient();

    let subjectId = v.subject_id;
    if (v.subject_mode === "new") {
      const s = parseInput(subjectSchema, { code: v.new_subject_code, title: v.new_subject_title, is_active: true });
      const { data, error } = await supabase.from("subjects").insert({ code: s.code, title: s.title, created_by: user.id }).select("id").single();
      if (error) throw dbError(error, { unique: `Subject code ${s.code} already exists. Choose "Existing subject" instead.` });
      subjectId = data.id;
    }

    const { data, error } = await supabase.from("subject_offerings").insert({
      subject_id: subjectId!, faculty_id: v.faculty_id, program_id: v.program_id,
      academic_period_id: v.academic_period_id, section: v.section, created_by: user.id,
    }).select("id").single();
    if (error) throw dbError(error, { unique: "This subject is already assigned to this teacher and section for the selected semester." });

    const { data: o } = await supabase.from("offering_overview").select("subject_code, faculty_name, period_label").eq("id", data.id).single();
    await logActivity({
      user, module: "Survey", action: "Added subject offering",
      description: `${o?.subject_code}${v.section ? ` (${v.section})` : ""} – ${o?.faculty_name} – ${o?.period_label}`,
      entityType: "subject_offerings", entityId: data.id,
    });
    revalidatePath("/admin/surveys");
    return { id: data.id };
  }, "Subject added to the survey.");
}

/** Soft delete: evaluation history for the class is preserved. */
export async function deleteOffering(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const oid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { data: o } = await supabase.from("offering_overview").select("subject_code, section, faculty_name, period_label, completed_count").eq("id", oid).maybeSingle();
    if (!o) throw new UserFacingError("Class not found.");
    const { error } = await supabase.from("subject_offerings").update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq("id", oid);
    if (error) throw dbError(error);
    await logActivity({
      user, module: "Survey", action: "Deleted subject offering",
      description: `${o.subject_code}${o.section ? ` (${o.section})` : ""} – ${o.faculty_name} – ${o.period_label} (${o.completed_count} completed evaluations archived)`,
      entityType: "subject_offerings", entityId: oid,
    });
    revalidatePath("/admin/surveys");
    return null;
  }, "Subject removed from the survey. Historical records were archived.");
}

export async function enrollStudents(raw: unknown): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(enrollSchema, raw);
    const supabase = await createClient();
    const { data, error } = await supabase.from("subject_enrollments")
      .upsert(v.student_ids.map((sid) => ({ offering_id: v.offering_id, student_id: sid, created_by: user.id })), {
        onConflict: "offering_id,student_id", ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw dbError(error, { foreignKey: "One or more selected students or the class no longer exist." });
    const added = data?.length ?? 0;
    await logActivity({ user, module: "Survey", action: "Enrolled students", description: `${added} student(s) enrolled`, entityType: "subject_offerings", entityId: v.offering_id });
    revalidatePath(`/admin/surveys/${v.offering_id}`);
    return { added };
  }, "Students enrolled.");
}

export async function removeEnrollment(input: { enrollmentId: string; offeringId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(z.object({ enrollmentId: z.uuid(), offeringId: z.uuid() }), input);
    const supabase = await createClient();
    const { data, error } = await supabase.from("subject_enrollments").delete().eq("id", v.enrollmentId).select("student_id").maybeSingle();
    if (error) throw dbError(error, { foreignKey: "This student already has an evaluation for this class. Reset the evaluation first." });
    if (!data) throw new UserFacingError("Enrollment not found.");
    await logActivity({ user, module: "Survey", action: "Removed student from class", entityType: "subject_offerings", entityId: v.offeringId, metadata: { student_id: data.student_id } });
    revalidatePath(`/admin/surveys/${v.offeringId}`);
    return null;
  }, "Student removed from the class.");
}

export async function resetEvaluationAttempt(input: { attemptId: string; offeringId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(z.object({ attemptId: z.uuid(), offeringId: z.uuid() }), input);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_reset_evaluation", { p_attempt_id: v.attemptId });
    if (error) throw dbError(error);
    const info = (data ?? {}) as { student_number?: string; subject_code?: string; status?: string };
    await logActivity({
      user, module: "Evaluation", action: "Reset evaluation attempt",
      description: `Student ${info.student_number} – ${info.subject_code} (${info.status}) reset; the student may answer again.`,
      entityType: "subject_offerings", entityId: v.offeringId,
    });
    revalidatePath(`/admin/surveys/${v.offeringId}`);
    return null;
  }, "Evaluation reset. The student can answer the evaluation again.");
}

export type AttemptAnswers = {
  student: string;
  status: string;
  submitted_at: string | null;
  average: number | null;
  answers: { category: string; title: string; question: string; rating: number; label: string | null; scale_max: number }[];
  comment: string | null;
};

/** Administrator-only view of one student's answers (access is audit-logged). */
export async function getAttemptAnswers(attemptId: string): Promise<ActionResult<AttemptAnswers>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const aid = parseInput(z.uuid(), attemptId);
    const supabase = await createClient();
    const { data: attempt } = await supabase.from("evaluation_attempts").select("id, status, submitted_at, average_rating, student_id, offering_id").eq("id", aid).maybeSingle();
    if (!attempt) throw new UserFacingError("Evaluation not found.");
    const [{ data: answers }, { data: comment }, { data: student }] = await Promise.all([
      supabase.from("evaluation_answers").select("category_name, question_title, question_text, rating, rating_label, scale_max, questions(sort_order), question_categories(sort_order)").eq("attempt_id", aid),
      supabase.from("evaluation_comments").select("comment").eq("attempt_id", aid).maybeSingle(),
      supabase.from("student_overview").select("full_name, student_number").eq("id", attempt.student_id).maybeSingle(),
    ]);
    await logActivity({ user, module: "Evaluation", action: "Viewed student evaluation answers", description: `Student ${student?.student_number}`, entityType: "subject_offerings", entityId: attempt.offering_id });
    const sorted = (answers ?? []).slice().sort((a, b) =>
      ((a.question_categories?.sort_order ?? 0) - (b.question_categories?.sort_order ?? 0)) ||
      a.category_name.localeCompare(b.category_name) ||
      ((a.questions?.sort_order ?? 0) - (b.questions?.sort_order ?? 0)) || a.question_title.localeCompare(b.question_title));
    return {
      student: `${student?.full_name ?? ""} (${student?.student_number ?? ""})`,
      status: attempt.status,
      submitted_at: attempt.submitted_at,
      average: attempt.average_rating,
      answers: sorted.map((a) => ({ category: a.category_name, title: a.question_title, question: a.question_text, rating: a.rating, label: a.rating_label, scale_max: a.scale_max })),
      comment: comment?.comment ?? null,
    };
  });
}

export type StudentOption = { id: string; student_number: string; full_name: string; program_code: string; year_level_name: string };

/** Students not yet enrolled in the class, for the enrollment picker. */
export async function searchStudentsForEnrollment(input: { offeringId: string; q: string; programId?: string }): Promise<ActionResult<StudentOption[]>> {
  return runAction(async () => {
    await assertRole("admin");
    const v = parseInput(z.object({ offeringId: z.uuid(), q: z.string().max(80), programId: z.uuid().optional().or(z.literal("")) }), input);
    const supabase = await createClient();
    const { data: enrolled } = await supabase.from("subject_enrollments").select("student_id").eq("offering_id", v.offeringId);
    const exclude = new Set((enrolled ?? []).map((e) => e.student_id));
    let q = supabase.from("student_overview").select("id, student_number, full_name, program_code, year_level_name").eq("is_active", true);
    const term = v.q.toLowerCase().replace(/[^\p{L}\p{N}\s.@\-_]/gu, " ").trim();
    if (term) q = q.ilike("search_text", likePattern(term));
    if (v.programId) q = q.eq("program_id", v.programId);
    const { data } = await q.order("sort_name").limit(200);
    return (data ?? []).filter((s) => !exclude.has(s.id!)).slice(0, 100).map((s) => ({
      id: s.id!, student_number: s.student_number!, full_name: s.full_name!, program_code: s.program_code!, year_level_name: s.year_level_name!,
    }));
  });
}

// Subject catalog --------------------------------------------------------------
export async function saveSubject(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(z.object({ id: z.uuid().optional().or(z.literal("")).transform((x) => x || undefined) }), raw);
    const v = parseInput(subjectSchema, raw);
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("subjects").update(v).eq("id", id)
      : await supabase.from("subjects").insert({ ...v, created_by: user.id });
    if (error) throw dbError(error, { unique: `Subject code ${v.code} already exists.` });
    await logActivity({ user, module: "Subjects", action: id ? "Updated subject" : "Created subject", description: `${v.code} – ${v.title}`, entityType: "subjects", entityId: id });
    revalidatePath("/admin/subjects");
    return null;
  }, "Subject saved.");
}
