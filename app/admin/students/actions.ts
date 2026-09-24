"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { bulkIds, bulkMessage, dbError, parseInput, runAction, UserFacingError, type ActionResult, type BulkResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { studentSchema } from "@/lib/validation/people";
import { createStudentRecord } from "@/lib/people/create";
import { deleteAccount, resetAccountPassword, setAccountActive, updateAccountEmail } from "@/lib/auth/accounts";
import { formatPersonName } from "@/lib/format";

const UNIQUE_MSG = "A student with this Student ID or email already exists.";

export async function createStudent(raw: unknown): Promise<ActionResult<{ tempPassword: string; email: string }>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(studentSchema, raw);
    const supabase = await createClient();

    const [{ count: byId }, { count: byEmail }] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("student_number", v.student_number),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("email", v.email),
    ]);
    if (byId) throw new UserFacingError(UNIQUE_MSG, { student_number: ["Student ID is already in use."] });
    if (byEmail) throw new UserFacingError(UNIQUE_MSG, { email: ["Email is already in use."] });

    const created = await createStudentRecord(supabase, user.id, v);
    await logActivity({
      user, module: "Students", action: "Created student account",
      description: `${v.student_number} – ${formatPersonName(v.first_name, v.middle_name, v.last_name)}`, entityType: "students", entityId: created.id,
    });
    revalidatePath("/admin/students");
    return { tempPassword: created.tempPassword, email: v.email };
  }, "Student account created.");
}

export async function updateStudent(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(z.object({ id: z.uuid() }), raw);
    const v = parseInput(studentSchema, raw);
    const supabase = await createClient();
    const { data: before } = await supabase.from("students").select("email, profile_id").eq("id", id).single();
    if (!before) throw new UserFacingError("Student not found.");

    const { error } = await supabase.from("students").update(v).eq("id", id);
    if (error) throw dbError(error, { unique: UNIQUE_MSG, foreignKey: "Select a valid program and year level." });
    if (before.profile_id && before.email.toLowerCase() !== v.email) {
      try {
        await updateAccountEmail(before.profile_id, v.email);
      } catch (e) {
        await supabase.from("students").update({ email: before.email }).eq("id", id);
        throw e;
      }
    }
    await logActivity({ user, module: "Students", action: "Updated student", description: v.student_number, entityType: "students", entityId: id });
    revalidatePath("/admin/students");
    return null;
  }, "Student updated.");
}

export async function setStudentActive(input: { id: string; active: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(z.object({ id: z.uuid(), active: z.boolean() }), input);
    const supabase = await createClient();
    const { data, error } = await supabase.from("students").update({ is_active: v.active }).eq("id", v.id).select("student_number, profile_id").single();
    if (error) throw dbError(error);
    if (data.profile_id) await setAccountActive(data.profile_id, v.active);
    await logActivity({ user, module: "Students", action: v.active ? "Activated student" : "Deactivated student", description: data.student_number, entityType: "students", entityId: v.id });
    revalidatePath("/admin/students");
    return null;
  }, input.active ? "Student activated." : "Student deactivated. The account can no longer sign in.");
}

export type DeletionImpact = { records: number; enrollments: number; completed: number; inProgress: number };

/** What deleting these students would also remove (for the confirmation dialog). */
export async function getStudentDeletionImpact(ids: string[]): Promise<ActionResult<DeletionImpact>> {
  return runAction(async () => {
    await assertRole("admin");
    const sids = [...new Set(parseInput(bulkIds, ids))];
    const supabase = await createClient();
    const [{ count: enrollments, error: e1 }, { data: attempts, error: e2 }] = await Promise.all([
      supabase.from("subject_enrollments").select("id", { count: "exact", head: true }).in("student_id", sids),
      supabase.from("evaluation_attempts").select("status").in("student_id", sids),
    ]);
    if (e1 || e2) throw dbError((e1 ?? e2)!);
    return {
      records: sids.length,
      enrollments: enrollments ?? 0,
      completed: (attempts ?? []).filter((a) => a.status === "completed").length,
      inProgress: (attempts ?? []).filter((a) => a.status === "in_progress").length,
    };
  });
}

type StudentDeleteSummary = { students: { id: string; student_number: string; profile_id: string | null }[]; enrollments: number; attempts: number; completed: number };

/**
 * Permanent delete of students together with their class enrollments and
 * evaluations (answers, comments) in one database transaction — see
 * admin_delete_students. Classes, faculty and other students are never
 * touched. Login accounts are removed afterwards.
 */
async function purgeStudents(ids: string[]): Promise<BulkResult> {
  const user = await assertRole("admin");
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("students").select("id").in("id", ids);
  if (error) throw dbError(error);
  const known = new Set((rows ?? []).map((r) => r.id));
  const skipped: BulkResult["skipped"] = ids.filter((id) => !known.has(id)).map((id) => ({ id, label: "Unknown student", reason: "not found" }));
  if (!known.size) throw new UserFacingError(ids.length === 1 ? "Student not found. They may have been deleted already." : "None of the selected students were found.");

  const { data, error: rpcError } = await supabase.rpc("admin_delete_students", { p_student_ids: [...known] });
  if (rpcError) throw dbError(rpcError, { foreignKey: "The student could not be deleted because other records still depend on them. Nothing was deleted." });
  const r = data as unknown as StudentDeleteSummary;
  for (const s of r.students) if (s.profile_id) await deleteAccount(s.profile_id);

  await logActivity({
    user, module: "Students", action: r.students.length === 1 ? "Deleted student" : "Deleted students",
    description: `${r.students.map((s) => s.student_number).join(", ")} — removed ${r.enrollments} enrollment(s) and ${r.attempts} evaluation(s) (${r.completed} submitted).`,
    entityType: "students", entityId: r.students.length === 1 ? r.students[0].id : undefined,
    metadata: { deleted: r.students.map((s) => s.id), enrollments: r.enrollments, attempts: r.attempts, completed: r.completed },
  });
  revalidatePath("/admin/students");
  return { done: r.students.length, skipped };
}

/** Permanently deletes a student, including enrollments and evaluations (after the UI's cascade warning). */
export async function deleteStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await purgeStudents([parseInput(z.uuid(), id)]);
    return null;
  }, "Student and all connected records were permanently deleted.");
}

/** Bulk version of deleteStudent. */
export async function deleteStudents(ids: string[]): Promise<ActionResult<BulkResult>> {
  const res = await runAction(async () => purgeStudents([...new Set(parseInput(bulkIds, ids))]));
  return res.ok ? { ...res, message: bulkMessage(res.data.done, "deleted", res.data.skipped) } : res;
}

export async function resetStudentPassword(id: string): Promise<ActionResult<{ tempPassword: string }>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const sid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { data } = await supabase.from("students").select("student_number, profile_id").eq("id", sid).single();
    if (!data?.profile_id) throw new UserFacingError("This student has no login account.");
    const tempPassword = await resetAccountPassword(data.profile_id);
    await logActivity({ user, module: "Students", action: "Reset student password", description: data.student_number, entityType: "students", entityId: sid });
    return { tempPassword };
  }, "Temporary password generated.");
}
