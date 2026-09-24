"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { categorySchema, questionSchema } from "@/lib/validation/master";

const optionalId = z.object({ id: z.uuid().optional().or(z.literal("")).transform((v) => v || undefined) });

export async function saveCategory(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(optionalId, raw);
    const v = parseInput(categorySchema, raw);
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("question_categories").update(v).eq("id", id)
      : await supabase.from("question_categories").insert({ ...v, created_by: user.id });
    if (error) throw dbError(error, { unique: "A category with this name already exists." });
    await logActivity({ user, module: "Categories", action: id ? "Updated category" : "Created category", description: v.name, entityType: "question_categories", entityId: id });
    revalidatePath("/admin/categories");
    revalidatePath("/admin/questions");
    return null;
  }, "Category saved.");
}

/**
 * Editing a question never alters historical results: submitted answers keep a
 * snapshot of the question and category text.
 */
export async function saveQuestion(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(optionalId, raw);
    const v = parseInput(questionSchema, raw);
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("questions").update(v).eq("id", id)
      : await supabase.from("questions").insert({ ...v, created_by: user.id });
    if (error) throw dbError(error, { foreignKey: "Select a valid category." });
    await logActivity({ user, module: "Questions", action: id ? "Updated question" : "Created question", description: `${v.title}: ${v.content.slice(0, 120)}`, entityType: "questions", entityId: id });
    revalidatePath("/admin/questions");
    revalidatePath("/admin/categories");
    return null;
  }, "Question saved.");
}
