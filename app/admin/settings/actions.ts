"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import {
  departmentSchema, evaluationSettingsSchema, periodSchema, programSchema, systemSettingsSchema, yearLevelSchema,
} from "@/lib/validation/master";
import { fromDateTimeLocal, periodLabel } from "@/lib/format";
import type { Json } from "@/types/database";

const optionalId = z.object({ id: z.uuid().optional().or(z.literal("")).transform((v) => v || undefined) });

function revalidateSettings() {
  revalidatePath("/admin/settings");
}

export async function saveDepartment(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(optionalId, raw);
    const v = parseInput(departmentSchema, raw);
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("departments").update(v).eq("id", id)
      : await supabase.from("departments").insert({ ...v, created_by: user.id });
    if (error) throw dbError(error, { unique: "A department with this code or name already exists." });
    await logActivity({ user, module: "Settings", action: id ? "Updated department" : "Created department", description: `${v.code} – ${v.name}`, entityType: "departments", entityId: id });
    revalidateSettings();
    return null;
  }, "Department saved.");
}

export async function saveProgram(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(optionalId, raw);
    const v = parseInput(programSchema, raw);
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("programs").update(v).eq("id", id)
      : await supabase.from("programs").insert({ ...v, created_by: user.id });
    if (error) throw dbError(error, { unique: "A program with this code already exists.", foreignKey: "Select a valid department." });
    await logActivity({ user, module: "Settings", action: id ? "Updated program" : "Created program", description: `${v.code} – ${v.name}`, entityType: "programs", entityId: id });
    revalidateSettings();
    return null;
  }, "Program saved.");
}

export async function saveYearLevel(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(optionalId, raw);
    const v = parseInput(yearLevelSchema, raw);
    const supabase = await createClient();
    const { error } = id
      ? await supabase.from("year_levels").update(v).eq("id", id)
      : await supabase.from("year_levels").insert(v);
    if (error) throw dbError(error, { unique: "A year level with this name already exists." });
    await logActivity({ user, module: "Settings", action: id ? "Updated year level" : "Created year level", description: v.name, entityType: "year_levels", entityId: id });
    revalidateSettings();
    return null;
  }, "Year level saved.");
}

// ---------------------------------------------------------------------------
// Survey schedule (academic periods)
// ---------------------------------------------------------------------------
export async function savePeriod(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { id } = parseInput(optionalId, raw);
    const v = parseInput(periodSchema, raw);
    const supabase = await createClient();
    const row = {
      start_year: v.start_year,
      semester: v.semester,
      open_at: fromDateTimeLocal(v.open_at),
      close_at: fromDateTimeLocal(v.close_at),
    };
    const res = id
      ? await supabase.from("academic_periods").update(row).eq("id", id).select("id").single()
      : await supabase.from("academic_periods").insert({ ...row, created_by: user.id }).select("id").single();
    if (res.error) {
      throw dbError(res.error, {
        unique: `A schedule for ${periodLabel(v.start_year, v.semester)} already exists.`,
      });
    }
    if (v.is_current) {
      const { error } = await supabase.rpc("admin_set_current_period", { p_period_id: res.data.id });
      if (error) throw dbError(error);
    }
    await logActivity({
      user, module: "Settings", action: id ? "Changed survey schedule" : "Created survey schedule",
      description: `${periodLabel(v.start_year, v.semester)}: ${row.open_at} → ${row.close_at}${v.is_current ? " (set as active)" : ""}`,
      entityType: "academic_periods", entityId: res.data.id,
    });
    revalidateSettings();
    revalidatePath("/admin", "layout");
    return null;
  }, "Survey schedule saved.");
}

export async function setCurrentPeriod(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const pid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_current_period", { p_period_id: pid });
    if (error) throw dbError(error);
    const { data } = await supabase.from("academic_periods").select("label").eq("id", pid).single();
    await logActivity({ user, module: "Settings", action: "Set active evaluation period", description: data?.label ?? pid, entityType: "academic_periods", entityId: pid });
    revalidatePath("/admin", "layout");
    return null;
  }, "Active evaluation period updated.");
}

export async function deletePeriod(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const pid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { data, error } = await supabase.from("academic_periods").delete().eq("id", pid).select("label, is_current").maybeSingle();
    if (error) throw dbError(error, { foreignKey: "This period already has classes or evaluations and cannot be deleted." });
    if (!data) throw new UserFacingError("Schedule not found.");
    await logActivity({ user, module: "Settings", action: "Deleted survey schedule", description: data.label ?? pid, entityType: "academic_periods", entityId: pid });
    revalidatePath("/admin", "layout");
    return null;
  }, "Survey schedule deleted.");
}

export async function releaseResults(input: { periodId: string; release: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(z.object({ periodId: z.uuid(), release: z.boolean() }), input);
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_release_results", { p_period_id: v.periodId, p_release: v.release });
    if (error) throw dbError(error);
    const { data } = await supabase.from("academic_periods").select("label").eq("id", v.periodId).single();
    await logActivity({
      user, module: "Settings", action: v.release ? "Released evaluation results" : "Withdrew evaluation results",
      description: data?.label ?? v.periodId, entityType: "academic_periods", entityId: v.periodId,
    });
    revalidateSettings();
    return null;
  }, input.release ? "Results released to faculty." : "Results hidden from faculty.");
}

// ---------------------------------------------------------------------------
// Evaluation + system settings
// ---------------------------------------------------------------------------
async function upsertSettings(entries: Record<string, Json>, userId: string) {
  const supabase = await createClient();
  for (const [key, value] of Object.entries(entries)) {
    const { error } = await supabase.from("system_settings").update({ value, updated_by: userId }).eq("key", key);
    if (error) throw dbError(error);
  }
}

export async function saveEvaluationSettings(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(evaluationSettingsSchema, raw);
    await upsertSettings({
      results_visibility: v.results_visibility,
      min_respondents: v.min_respondents,
      allow_comments: v.allow_comments,
      require_comments: v.require_comments && v.allow_comments,
      deadline_reminder_days: v.deadline_reminder_days,
      rating_scale: v.scale,
    }, user.id);
    await logActivity({ user, module: "Settings", action: "Updated evaluation settings", description: `Visibility: ${v.results_visibility}; min respondents: ${v.min_respondents}; scale: 1–${v.scale.length}` });
    revalidatePath("/admin", "layout");
    return null;
  }, "Evaluation settings saved.");
}

export async function saveSystemSettings(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(systemSettingsSchema, raw);
    await upsertSettings({ system_name: v.system_name, institution_name: v.institution_name, institution_address: v.institution_address ?? "" }, user.id);
    await logActivity({ user, module: "Settings", action: "Updated system settings" });
    revalidateSettings();
    return null;
  }, "System settings saved.");
}
