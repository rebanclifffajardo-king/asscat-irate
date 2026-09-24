"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, runAction, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { commitRecords, importFile, recordPreview, resultMessage } from "@/lib/import/records";
import { validateQuestionFile } from "@/lib/import/questions";
import type { ImportPreview, RecordImportResult } from "@/lib/import/types";

export async function previewQuestionImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    await assertRole("admin");
    const file = importFile(formData);
    const supabase = await createClient();
    return recordPreview(file.name, await validateQuestionFile(file, supabase));
  });
}

/** Re-validates the file on the server (never trusts the preview), then creates the new rows. */
export async function commitQuestionImport(formData: FormData): Promise<ActionResult<RecordImportResult>> {
  const res = await runAction(async () => {
    const user = await assertRole("admin");
    const file = importFile(formData);
    const supabase = await createClient();
    const rows = await validateQuestionFile(file, supabase);
    // Same insert as saveQuestion.
    const result = await commitRecords(rows, async (v) => {
      const { error } = await supabase.from("questions").insert({ ...v, created_by: user.id });
      if (error) throw dbError(error, { foreignKey: "Select a valid category." });
      return {};
    });
    const c = result.counts;
    await logActivity({
      user, module: "Import", action: "Imported questions",
      description: `${file.name}: ${c.added} added, ${c.skipped} skipped (already exist), ${c.failed} failed.`,
      metadata: { file: file.name, ...c },
    });
    if (c.added) {
      revalidatePath("/admin/questions");
      revalidatePath("/admin/categories");
    }
    return result;
  });
  return res.ok ? { ...res, message: `Import finished: ${resultMessage(res.data.counts)}` } : res;
}
