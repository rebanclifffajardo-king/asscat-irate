"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, type ActionResult } from "@/lib/actions";
import { logActivity, type ActivityModule } from "@/lib/activity";

/** Simple master-data tables that share activate/deactivate/delete behavior. */
const ENTITIES = {
  department: { table: "departments", module: "Settings", label: "Department", path: "/admin/settings", name: "name" },
  program: { table: "programs", module: "Settings", label: "Program", path: "/admin/settings", name: "name" },
  year_level: { table: "year_levels", module: "Settings", label: "Year level", path: "/admin/settings", name: "name" },
  category: { table: "question_categories", module: "Categories", label: "Category", path: "/admin/categories", name: "name" },
  question: { table: "questions", module: "Questions", label: "Question", path: "/admin/questions", name: "title" },
  subject: { table: "subjects", module: "Subjects", label: "Subject", path: "/admin/subjects", name: "code" },
} as const;

export type SimpleEntity = keyof typeof ENTITIES;

const input = z.object({
  entity: z.enum(Object.keys(ENTITIES) as [SimpleEntity, ...SimpleEntity[]]),
  id: z.uuid(),
  active: z.boolean().optional(),
});

export async function setEntityActive(raw: { entity: SimpleEntity; id: string; active: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { entity, id, active } = parseInput(input, raw);
    const cfg = ENTITIES[entity];
    const supabase = await createClient();
    const { data, error } = await supabase.from(cfg.table).update({ is_active: !!active }).eq("id", id).select(cfg.name).maybeSingle();
    if (error) throw dbError(error);
    const name = data ? String((data as unknown as Record<string, unknown>)[cfg.name]) : id;
    await logActivity({
      user, module: cfg.module as ActivityModule, action: `${active ? "Activated" : "Deactivated"} ${cfg.label.toLowerCase()}`,
      description: `${cfg.label} "${name}" ${active ? "activated" : "deactivated"}`, entityType: cfg.table, entityId: id,
    });
    revalidatePath(cfg.path);
    return null;
  }, `${ENTITIES[raw.entity]?.label ?? "Record"} ${raw.active ? "activated" : "deactivated"}.`);
}

export async function deleteEntity(raw: { entity: SimpleEntity; id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const { entity, id } = parseInput(input, raw);
    const cfg = ENTITIES[entity];
    const supabase = await createClient();
    const { data, error } = await supabase.from(cfg.table).delete().eq("id", id).select(cfg.name).maybeSingle();
    if (error) {
      throw dbError(error, {
        foreignKey: `This ${cfg.label.toLowerCase()} is used by existing records (including historical evaluations) and cannot be deleted. Deactivate it instead.`,
      });
    }
    if (!data) throw dbError({ code: "P0002", message: `${cfg.label} not found.` });
    const name = String((data as unknown as Record<string, unknown>)[cfg.name]);
    await logActivity({
      user, module: cfg.module as ActivityModule, action: `Deleted ${cfg.label.toLowerCase()}`,
      description: `${cfg.label} "${name}" deleted`, entityType: cfg.table, entityId: id,
    });
    revalidatePath(cfg.path);
    return null;
  }, `${ENTITIES[raw.entity]?.label ?? "Record"} deleted.`);
}
