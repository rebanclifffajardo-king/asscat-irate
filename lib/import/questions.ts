import "server-only";
import type { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";
import { questionSchema } from "@/lib/validation/master";
import { parseSpreadsheet } from "./parse";
import { FileDuplicates, issueMessages, parseYesNo, type RecordRow } from "./records";

export const QUESTION_COLUMNS: Record<string, string[]> = {
  category: ["category", "categoryname"],
  title: ["questiontitle", "title", "questioncode", "code"],
  content: ["questioncontent", "content", "question", "questiontext"],
  sort_order: ["displayorder", "sortorder", "order"],
  is_required: ["required", "isrequired"],
  is_active: ["active", "isactive"],
};

export type QuestionInput = z.infer<typeof questionSchema>;

const low = (s: string) => s.trim().toLowerCase();

/** Questions are matched by title within the same category (case-insensitive). */
export async function validateQuestionFile(file: File, supabase: ServerSupabase): Promise<RecordRow<QuestionInput>[]> {
  const { rows } = await parseSpreadsheet(file, QUESTION_COLUMNS, ["category", "title", "content"], 1000);
  const [{ data: categories }, { data: questions }] = await Promise.all([
    supabase.from("question_categories").select("id, name, is_active"),
    supabase.from("questions").select("category_id, title"),
  ]);
  const categoryByName = new Map((categories ?? []).map((c) => [low(c.name), c]));
  const existing = new Set((questions ?? []).map((q) => `${q.category_id}|${low(q.title)}`));

  const dupes = new FileDuplicates();
  const out: RecordRow<QuestionInput>[] = [];
  for (const r of rows) {
    const v = r.values;
    const lookupErrors: Record<string, string> = {};
    const catName = (v.category ?? "").trim();
    const cat = categoryByName.get(low(catName));
    if (catName && !cat) lookupErrors.category_id = `Category "${catName}" does not exist.`;
    else if (cat && !cat.is_active) lookupErrors.category_id = `Category ${cat.name} is inactive.`;
    const required = parseYesNo(v.is_required ?? "", true);
    if (required === null) lookupErrors.is_required = `Required must be Yes or No (got "${v.is_required}").`;
    const order = (v.sort_order ?? "").trim();
    if (order && !/^\d{1,4}$/.test(order)) lookupErrors.sort_order = `Display order must be a whole number from 0 to 1000 (got "${order}").`;
    const active = parseYesNo(v.is_active ?? "", true);
    if (active === null) lookupErrors.is_active = `Active must be Yes or No (got "${v.is_active}").`;

    const parsed = questionSchema.safeParse({
      title: v.title ?? "", content: v.content ?? "", category_id: cat && !lookupErrors.category_id ? cat.id : "",
      sort_order: (v.sort_order ?? "").trim() || undefined, is_required: required ?? true, is_active: active ?? true,
    });
    const errors = [...Object.values(lookupErrors), ...(parsed.success ? [] : issueMessages(parsed.error, Object.keys(lookupErrors)))];
    const base = { row: r.rowNumber, cells: v, warnings: [] as string[] };
    if (errors.length || !parsed.success) {
      out.push({ ...base, status: "invalid", errors });
      continue;
    }
    const q = parsed.data;
    const key = `${q.category_id}|${low(q.title)}`;
    if (existing.has(key)) {
      out.push({ ...base, status: "exists", errors: [], warnings: [`Already exists (${q.title} in ${cat!.name}) — skipped.`] });
      continue;
    }
    const earlier = dupes.find([key]);
    if (earlier !== undefined) {
      out.push({ ...base, status: "exists", errors: [], warnings: [`Duplicate of row ${earlier} in this file — skipped.`] });
      continue;
    }
    dupes.add([key], r.rowNumber);
    out.push({ ...base, status: "add", errors: [], data: q });
  }
  return out;
}
