"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { validateCourseFile } from "@/lib/import/course";
import { importFile as fileFrom, previewRows } from "@/lib/import/records";
import { validateEvaluationFile } from "@/lib/import/evaluation";
import { getSettings } from "@/lib/data/lookups";
import type { ImportPreview } from "@/lib/import/types";
import type { Json } from "@/types/database";

export type { ImportPreview };

async function notify(userId: string, title: string, message: string, type: "success" | "warning" | "error") {
  const supabase = await createClient();
  await supabase.from("notifications").insert({ user_id: userId, title, message, type, link: "/admin/surveys" });
}

export async function previewCourseImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    await assertRole("admin");
    const file = fileFrom(formData);
    const supabase = await createClient();
    const v = await validateCourseFile(file, supabase);
    return { fileName: file.name, rows: previewRows(v.rows), summary: v.summary };
  });
}

export async function commitCourseImport(formData: FormData): Promise<ActionResult<Record<string, number>>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const file = fileFrom(formData);
    const supabase = await createClient();
    // Re-validate on the server: never trust the earlier preview.
    const v = await validateCourseFile(file, supabase);
    if (v.summary.errors > 0) {
      await notify(user.id, "Import finished with validation errors", `${file.name}: ${v.summary.errors} row(s) have errors. Nothing was imported.`, "error");
      throw new UserFacingError(`${v.summary.errors} row(s) have errors. Fix the file and upload it again — nothing was imported.`);
    }
    const { data, error } = await supabase.rpc("admin_import_course_rows", { p_rows: v.payload as unknown as Json });
    if (error) throw dbError(error);
    const result = data as Record<string, number>;
    await logActivity({
      user, module: "Import", action: "Imported course file",
      description: `${file.name}: ${result.subjects_created} subject(s), ${result.offerings_created} class(es), ${result.enrollments_created} enrollment(s) created; ${result.enrollments_existing} already existed.`,
      metadata: { file: file.name, ...result },
    });
    await notify(user.id, "Course import completed", `${file.name}: ${result.offerings_created} class(es) and ${result.enrollments_created} enrollment(s) created.`, "success");
    revalidatePath("/admin/surveys");
    return result;
  }, "Course file imported.");
}

export async function previewEvaluationImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    await assertRole("admin");
    const file = fileFrom(formData);
    const supabase = await createClient();
    const settings = await getSettings();
    const v = await validateEvaluationFile(file, supabase, settings.rating_scale.length);
    return { fileName: file.name, rows: previewRows(v.rows), summary: v.summary };
  });
}

export async function commitEvaluationImport(formData: FormData): Promise<ActionResult<Record<string, number>>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const file = fileFrom(formData);
    const supabase = await createClient();
    const settings = await getSettings();
    const v = await validateEvaluationFile(file, supabase, settings.rating_scale.length);
    if (v.summary.errors > 0) {
      await notify(user.id, "Import finished with validation errors", `${file.name}: ${v.summary.errors} row(s) have errors. Nothing was imported.`, "error");
      throw new UserFacingError(`${v.summary.errors} row(s) have errors. Fix the file and upload it again — nothing was imported.`);
    }
    const { data, error } = await supabase.rpc("admin_import_evaluation_rows", { p_rows: v.payload as unknown as Json });
    if (error) throw dbError(error);
    const result = data as Record<string, number>;
    await logActivity({
      user, module: "Import", action: "Imported evaluation file",
      description: `${file.name}: ${result.evaluations_created} evaluation(s) created, ${result.evaluations_skipped} existing preserved.`,
      metadata: { file: file.name, ...result },
    });
    await notify(user.id, result.evaluations_skipped ? "Evaluation import finished with skipped records" : "Evaluation import completed",
      `${file.name}: ${result.evaluations_created} created, ${result.evaluations_skipped} skipped (already existed).`,
      result.evaluations_skipped ? "warning" : "success");
    revalidatePath("/admin/surveys");
    return result;
  }, "Evaluation file imported.");
}
