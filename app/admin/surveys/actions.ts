"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { bulkIds, bulkMessage, dbError, parseInput, runAction, UserFacingError, type ActionResult, type BulkResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { enrollSchema, offeringSchema, offeringUpdateSchema } from "@/lib/validation/survey";
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
      if (error) throw dbError(error, { unique: `Course number ${s.code} already exists. Choose "Existing subject" instead.` });
      subjectId = data.id;
    }

    const { data, error } = await supabase.from("subject_offerings").insert({
      subject_id: subjectId!, faculty_id: v.faculty_id, program_id: v.program_id,
      academic_period_id: v.academic_period_id, section: v.section, created_by: user.id,
    }).select("id").single();
    if (error) throw dbError(error, { unique: "This subject is already assigned to this instructor and section for the selected semester." });

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

/** Changing the instructor keeps existing evaluations attached to this offering. */
export async function updateOffering(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(offeringUpdateSchema, raw);
    const supabase = await createClient();
    const { data: before } = await supabase.from("offering_overview")
      .select("subject_code, section, faculty_id, faculty_name, period_label, completed_count").eq("id", v.id).maybeSingle();
    if (!before) throw new UserFacingError("Class not found.");
    if (before.faculty_id === v.faculty_id && (before.section ?? "") === v.section) return null;

    if (before.faculty_id !== v.faculty_id) {
      const { data: f } = await supabase.from("faculty").select("is_active").eq("id", v.faculty_id).maybeSingle();
      if (!f?.is_active) throw new UserFacingError("Select a valid, active instructor.", { faculty_id: ["Select a valid, active instructor."] });
    }
    const { error } = await supabase.from("subject_offerings")
      .update({ faculty_id: v.faculty_id, section: v.section }).eq("id", v.id).is("deleted_at", null);
    if (error) throw dbError(error, { unique: "This subject is already assigned to this instructor and section for this semester.", foreignKey: "Select a valid instructor." });

    const { data: after } = await supabase.from("offering_overview").select("faculty_name").eq("id", v.id).maybeSingle();
    const changes = [
      before.faculty_id !== v.faculty_id && `instructor ${before.faculty_name} → ${after?.faculty_name}`,
      (before.section ?? "") !== v.section && `section ${before.section || "(none)"} → ${v.section || "(none)"}`,
    ].filter(Boolean).join("; ");
    await logActivity({
      user, module: "Survey", action: "Updated subject offering",
      description: `${before.subject_code} – ${before.period_label}: ${changes}${before.completed_count ? ` (${before.completed_count} submitted evaluation(s) stay attached)` : ""}`,
      entityType: "subject_offerings", entityId: v.id,
      metadata: { before: { faculty_id: before.faculty_id, section: before.section }, after: { faculty_id: v.faculty_id, section: v.section } },
    });
    revalidatePath("/admin/surveys");
    revalidatePath(`/admin/surveys/${v.id}`);
    return null;
  }, "Class updated.");
}

export type { BulkResult };

export type OfferingDeletionImpact = { offerings: number; enrollments: number; completed: number; inProgress: number };

/** What a permanent delete of these classes would remove (for the confirmation dialog). */
export async function getOfferingDeletionImpact(ids: string[]): Promise<ActionResult<OfferingDeletionImpact>> {
  return runAction(async () => {
    await assertRole("admin");
    const oids = [...new Set(parseInput(bulkIds, ids))];
    const supabase = await createClient();
    const { data, error } = await supabase.from("offering_overview").select("enrolled_count, completed_count, in_progress_count").in("id", oids);
    if (error) throw dbError(error);
    const sum = (k: "enrolled_count" | "completed_count" | "in_progress_count") => (data ?? []).reduce((n, o) => n + (o[k] ?? 0), 0);
    return { offerings: data?.length ?? 0, enrollments: sum("enrolled_count"), completed: sum("completed_count"), inProgress: sum("in_progress_count") };
  });
}

type DeleteSummary = { offering_ids: string[]; offerings: number; enrollments: number; attempts: number; completed: number; answers: number; comments: number };

/**
 * Permanent delete of classes and everything that depends on them
 * (enrollments, evaluation attempts, answers, comments) in one database
 * transaction — see admin_delete_offerings. Students, faculty and subjects
 * are never touched.
 */
async function purgeOfferings(ids: string[]): Promise<BulkResult> {
  const user = await assertRole("admin");
  const supabase = await createClient();
  const { data: before } = await supabase.from("offering_overview").select("id, subject_code, section, faculty_name, period_label").in("id", ids);
  const label = new Map((before ?? []).map((o) => [o.id!, `${o.subject_code}${o.section ? ` (${o.section})` : ""} – ${o.faculty_name} – ${o.period_label}`]));
  const known = ids.filter((id) => label.has(id));
  const skipped: BulkResult["skipped"] = ids.filter((id) => !label.has(id)).map((id) => ({ id, label: "Unknown class", reason: "not found" }));
  if (!known.length) throw new UserFacingError(ids.length === 1 ? "Class not found. It may have been deleted already." : "None of the selected classes were found.");

  const { data, error } = await supabase.rpc("admin_delete_offerings", { p_offering_ids: known });
  if (error) throw dbError(error, { foreignKey: "The class could not be deleted because other records still depend on it. Nothing was deleted." });
  const r = data as unknown as DeleteSummary;
  for (const id of known) if (!r.offering_ids.includes(id)) skipped.push({ id, label: label.get(id)!, reason: "not found" });

  await logActivity({
    user, module: "Survey", action: r.offerings === 1 ? "Permanently deleted subject offering" : "Permanently deleted subject offerings",
    description: `${r.offering_ids.map((id) => label.get(id)).join("; ")} — removed ${r.enrollments} enrollment(s), ${r.attempts} evaluation attempt(s) (${r.completed} submitted), ${r.answers} answer(s), ${r.comments} comment(s).`,
    entityType: "subject_offerings", entityId: r.offerings === 1 ? r.offering_ids[0] : undefined,
    metadata: { ...r },
  });
  revalidatePath("/admin/surveys");
  return { done: r.offerings, skipped };
}

/** Permanently deletes classes (bulk). Classes with evaluations are deleted too, after the UI's explicit confirmation. */
export async function deleteOfferings(ids: string[]): Promise<ActionResult<BulkResult>> {
  const res = await runAction(async () => purgeOfferings([...new Set(parseInput(bulkIds, ids))]));
  return res.ok ? { ...res, message: bulkMessage(res.data.done, "deleted", res.data.skipped) } : res;
}

/** Permanently deletes one class with all its enrollments and evaluation records. */
export async function deleteOffering(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await purgeOfferings([parseInput(z.uuid(), id)]);
    return null;
  }, "Subject and all of its evaluation records were permanently deleted.");
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

/** Bulk version of removeEnrollment: students with an evaluation attempt are skipped. */
export async function removeEnrollments(input: { offeringId: string; enrollmentIds: string[] }): Promise<ActionResult<BulkResult>> {
  const res = await runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(z.object({ offeringId: z.uuid(), enrollmentIds: z.array(z.string()) }), input);
    const ids = [...new Set(parseInput(bulkIds, v.enrollmentIds))];
    const supabase = await createClient();
    const { data, error } = await supabase.from("enrollment_overview")
      .select("id, student_id, student_number, student_name, attempt_id").eq("offering_id", v.offeringId).in("id", ids);
    if (error) throw dbError(error);
    const found = new Map((data ?? []).map((e) => [e.id!, e]));
    const label = (id: string) => { const e = found.get(id); return e ? `${e.student_name} (${e.student_number})` : "Unknown student"; };

    const skipped: BulkResult["skipped"] = [];
    const candidates: string[] = [];
    for (const id of ids) {
      const e = found.get(id);
      if (!e) skipped.push({ id, label: label(id), reason: "not found" });
      else if (e.attempt_id) skipped.push({ id, label: label(id), reason: "has an evaluation" });
      else candidates.push(id);
    }

    // Same rule as removeEnrollment: the FK from evaluation_attempts blocks the
    // delete. If an attempt appeared since the check, retry row by row.
    let removed: string[] = [];
    if (candidates.length) {
      const del = await supabase.from("subject_enrollments").delete().eq("offering_id", v.offeringId).in("id", candidates).select("id");
      if (!del.error) removed = (del.data ?? []).map((r) => r.id);
      else if (del.error.code === "23503") {
        for (const id of candidates) {
          const one = await supabase.from("subject_enrollments").delete().eq("id", id).select("id").maybeSingle();
          if (one.error?.code === "23503") skipped.push({ id, label: label(id), reason: "has an evaluation" });
          else if (one.error) throw dbError(one.error);
          else if (one.data) removed.push(id);
        }
      } else throw dbError(del.error);
      for (const id of candidates) {
        if (!removed.includes(id) && !skipped.some((s) => s.id === id)) skipped.push({ id, label: label(id), reason: "not found" });
      }
    }

    if (removed.length) {
      await logActivity({
        user, module: "Survey", action: "Removed students from class",
        description: `${removed.length} removed, ${skipped.length} skipped: ${removed.map((id) => found.get(id)?.student_number).join(", ")}`,
        entityType: "subject_offerings", entityId: v.offeringId,
        metadata: { student_ids: removed.map((id) => found.get(id)?.student_id ?? null), skipped: skipped.map((s) => ({ id: s.id, reason: s.reason })) },
      });
      revalidatePath(`/admin/surveys/${v.offeringId}`);
    }
    return { done: removed.length, skipped };
  });
  return res.ok ? { ...res, message: bulkMessage(res.data.done, "removed", res.data.skipped) } : res;
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
    if (error) throw dbError(error, { unique: `Course number ${v.code} already exists.` });
    await logActivity({ user, module: "Subjects", action: id ? "Updated subject" : "Created subject", description: `${v.code} – ${v.title}`, entityType: "subjects", entityId: id });
    revalidatePath("/admin/subjects");
    return null;
  }, "Subject saved.");
}
