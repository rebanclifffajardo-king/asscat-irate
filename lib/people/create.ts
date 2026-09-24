import "server-only";
import type { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";
import { dbError, UserFacingError } from "@/lib/actions";
import { createAccount, deleteAccount } from "@/lib/auth/accounts";
import type { facultySchema, studentSchema } from "@/lib/validation/people";

/**
 * Creates a login account plus the student / faculty record, removing the
 * account again if the record cannot be saved. Callers must have passed
 * assertRole("admin") and validated the input with the create-form schema.
 */
export async function createStudentRecord(supabase: ServerSupabase, createdBy: string, v: z.infer<typeof studentSchema>) {
  const account = await createAccount({ email: v.email, role: "student", firstName: v.first_name, lastName: v.last_name });
  const { data, error } = await supabase.from("students").insert({ ...v, profile_id: account.userId, created_by: createdBy }).select("id").single();
  if (error) {
    await deleteAccount(account.userId); // compensate: never leave an orphan account
    throw dbError(error, { unique: "A student with this Student ID or email already exists.", foreignKey: "Select a valid program and year level." });
  }
  return { id: data.id, tempPassword: account.tempPassword };
}

export async function createFacultyRecord(supabase: ServerSupabase, createdBy: string, v: z.infer<typeof facultySchema>) {
  // Department always follows the program (also enforced by a DB trigger + composite FK).
  const { data: program } = await supabase.from("programs").select("department_id, is_active").eq("id", v.program_id).maybeSingle();
  if (!program?.is_active) throw new UserFacingError("Select a valid, active program.", { program_id: ["Select a valid program."] });

  const account = await createAccount({ email: v.email, role: "faculty", firstName: v.first_name, lastName: v.last_name });
  const { data, error } = await supabase.from("faculty")
    .insert({ ...v, department_id: program.department_id, profile_id: account.userId, created_by: createdBy })
    .select("id").single();
  if (error) {
    await deleteAccount(account.userId);
    throw dbError(error, { unique: "A faculty member with this Faculty ID or email already exists.", foreignKey: "Select a valid program." });
  }
  return { id: data.id, tempPassword: account.tempPassword };
}
