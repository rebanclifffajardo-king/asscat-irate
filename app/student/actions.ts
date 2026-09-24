"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { evaluationPayloadSchema } from "@/lib/validation/survey";

/**
 * All evaluation rules (enrollment, open window, valid questions/ratings,
 * no edits after submission, no duplicates) are enforced again inside the
 * database functions — these actions cannot be used to bypass them.
 */
export async function saveEvaluationProgress(raw: unknown): Promise<ActionResult<{ saved_at: string }>> {
  return runAction(async () => {
    await assertRole("student");
    const v = parseInput(evaluationPayloadSchema, raw);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_evaluation_progress", {
      p_offering_id: v.offering_id, p_answers: v.answers, p_comment: v.comment ?? undefined,
    });
    if (error) throw dbError(error);
    return { saved_at: (data as { saved_at: string }).saved_at };
  });
}

export async function submitEvaluation(raw: unknown): Promise<ActionResult<{ submitted_at: string }>> {
  return runAction(async () => {
    const user = await assertRole("student");
    const v = parseInput(evaluationPayloadSchema, raw);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_evaluation", {
      p_offering_id: v.offering_id, p_answers: v.answers, p_comment: v.comment ?? undefined,
    });
    if (error) throw dbError(error);
    const { data: o } = await supabase.from("subject_offerings").select("subjects(code)").eq("id", v.offering_id).maybeSingle();
    // Logged without ratings/comments to protect evaluator confidentiality.
    await logActivity({ user, module: "Evaluation", action: "Submitted faculty evaluation", description: `Subject ${o?.subjects?.code ?? ""}`, entityType: "subject_offerings", entityId: v.offering_id });
    revalidatePath("/student/dashboard");
    return { submitted_at: (data as { submitted_at: string }).submitted_at };
  }, "Evaluation submitted. Thank you for your feedback!");
}
