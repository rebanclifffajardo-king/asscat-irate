"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { commitRecords, importFile, recordPreview, resultMessage } from "@/lib/import/records";
import { validateStudentFile } from "@/lib/import/people";
import { createStudentRecord } from "@/lib/people/create";
import type { ImportPreview, RecordImportResult } from "@/lib/import/types";

export async function previewStudentImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    await assertRole("admin");
    const file = importFile(formData);
    const supabase = await createClient();
    return recordPreview(file.name, await validateStudentFile(file, supabase));
  });
}

/** Re-validates the file on the server (never trusts the preview), then creates the new rows. */
export async function commitStudentImport(formData: FormData): Promise<ActionResult<RecordImportResult>> {
  const res = await runAction(async () => {
    const user = await assertRole("admin");
    const file = importFile(formData);
    const supabase = await createClient();
    const rows = await validateStudentFile(file, supabase);
    const result = await commitRecords(rows, (v) => createStudentRecord(supabase, user.id, v));
    const c = result.counts;
    await logActivity({
      user, module: "Import", action: "Imported students",
      description: `${file.name}: ${c.added} added, ${c.skipped} skipped (already exist), ${c.failed} failed.`,
      metadata: { file: file.name, ...c },
    });
    if (c.added) revalidatePath("/admin/students");
    return result;
  });
  return res.ok ? { ...res, message: `Import finished: ${resultMessage(res.data.counts)}` } : res;
}
