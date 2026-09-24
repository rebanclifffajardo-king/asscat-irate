"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { studentSchema } from "@/lib/validation/people";
import { createAccount, deleteAccount, resetAccountPassword, setAccountActive, updateAccountEmail } from "@/lib/auth/accounts";
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

    const account = await createAccount({ email: v.email, role: "student", firstName: v.first_name, lastName: v.last_name });
    const { data, error } = await supabase.from("students").insert({ ...v, profile_id: account.userId, created_by: user.id }).select("id").single();
    if (error) {
      await deleteAccount(account.userId); // compensate: never leave an orphan account
      throw dbError(error, { unique: UNIQUE_MSG, foreignKey: "Select a valid program and year level." });
    }
    await logActivity({
      user, module: "Students", action: "Created student account",
      description: `${v.student_number} – ${formatPersonName(v.first_name, v.middle_name, v.last_name)}`, entityType: "students", entityId: data.id,
    });
    revalidatePath("/admin/students");
    return { tempPassword: account.tempPassword, email: v.email };
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

export async function deleteStudent(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const sid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { data, error } = await supabase.from("students").delete().eq("id", sid).select("student_number, profile_id").maybeSingle();
    if (error) throw dbError(error, { foreignKey: "This student has enrollment or evaluation records and cannot be deleted. Deactivate the student instead." });
    if (!data) throw new UserFacingError("Student not found.");
    if (data.profile_id) await deleteAccount(data.profile_id);
    await logActivity({ user, module: "Students", action: "Deleted student", description: data.student_number, entityType: "students", entityId: sid });
    revalidatePath("/admin/students");
    return null;
  }, "Student deleted.");
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
