import "server-only";
import type { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";
import { facultySchema, studentSchema } from "@/lib/validation/people";
import { parseSpreadsheet } from "./parse";
import { FileDuplicates, inChunks, issueMessages, normalizeDate, type RecordRow } from "./records";

export const PEOPLE_IMPORT_MAX_ROWS = 1000;

const NAME_COLUMNS = {
  first_name: ["firstname", "givenname"],
  middle_name: ["middlename", "middleinitial", "mi"],
  last_name: ["lastname", "surname", "familyname"],
  email: ["email", "emailaddress"],
  program: ["program", "programcode"],
};

export const STUDENT_COLUMNS: Record<string, string[]> = {
  student_number: ["studentid", "studentnumber", "studentno", "idnumber"],
  ...NAME_COLUMNS,
  year_level: ["yearlevel", "year", "level"],
};

export const FACULTY_COLUMNS: Record<string, string[]> = {
  faculty_number: ["facultyid", "facultynumber", "facultyno", "instructorid", "teacherid", "employeeid"],
  ...NAME_COLUMNS,
  birthday: ["birthday", "birthdate", "dateofbirth"],
  date_started: ["datestarted", "datehired", "startdate"],
};

export type StudentInput = z.infer<typeof studentSchema>;
export type FacultyInput = z.infer<typeof facultySchema>;

const up = (s: string) => s.trim().toUpperCase();
const low = (s: string) => s.trim().toLowerCase();

async function lookupPrograms(supabase: ServerSupabase) {
  const { data } = await supabase.from("program_overview").select("id, code, is_active");
  return new Map((data ?? []).map((p) => [up(p.code!), { id: p.id!, code: p.code!, is_active: p.is_active! }]));
}

type Programs = Awaited<ReturnType<typeof lookupPrograms>>;

/** Program code → id, or a lookup error. Blank is left to the zod schema. */
function resolveProgram(code: string, programs: Programs): { id: string; error?: string } {
  if (!code.trim()) return { id: "" };
  const p = programs.get(up(code));
  if (!p) return { id: "", error: `Program "${code}" does not exist.` };
  if (!p.is_active) return { id: "", error: `Program ${p.code} is inactive.` };
  return { id: p.id };
}

/** Emails of any existing login account (student, faculty or admin). */
async function accountEmails(supabase: ServerSupabase, emails: string[]): Promise<Set<string>> {
  const rows = await inChunks(emails, 200, async (chunk) => (await supabase.from("profiles").select("email").in("email", chunk)).data ?? []);
  return new Set(rows.map((r) => low(r.email)));
}

type PersonConfig<T> = {
  columns: Record<string, string[]>;
  required: string[];
  idKey: "student_number" | "faculty_number";
  idLabel: string;
  /** existing records matching any of the IDs / emails */
  findExisting: (ids: string[], emails: string[]) => Promise<{ ids: string[]; emails: string[] }>;
  /** builds the create-form input; `lookupErrors` are keyed by form field */
  toInput: (v: Record<string, string>, programs: Programs) => { input: Record<string, unknown>; lookupErrors: Record<string, string> };
  schema: z.ZodType<T>;
  getId: (v: T) => string;
};

async function validatePeople<T extends { email: string }>(file: File, supabase: ServerSupabase, cfg: PersonConfig<T>): Promise<RecordRow<T>[]> {
  const { rows } = await parseSpreadsheet(file, cfg.columns, cfg.required, PEOPLE_IMPORT_MAX_ROWS);
  const ids = [...new Set(rows.map((r) => up(r.values[cfg.idKey] ?? "")).filter(Boolean))];
  const emails = [...new Set(rows.map((r) => low(r.values.email ?? "")).filter(Boolean))];
  const [programs, existing, accounts] = await Promise.all([lookupPrograms(supabase), cfg.findExisting(ids, emails), accountEmails(supabase, emails)]);
  const existingIds = new Set(existing.ids.map(up));
  const existingEmails = new Set(existing.emails.map(low));

  const dupes = new FileDuplicates();
  const out: RecordRow<T>[] = [];
  for (const r of rows) {
    const { input, lookupErrors } = cfg.toInput(r.values, programs);
    const parsed = cfg.schema.safeParse(input);
    const errors = [...Object.values(lookupErrors), ...(parsed.success ? [] : issueMessages(parsed.error, Object.keys(lookupErrors)))];
    const base = { row: r.rowNumber, cells: r.values, warnings: [] as string[] };
    if (errors.length || !parsed.success) {
      out.push({ ...base, status: "invalid", errors });
      continue;
    }
    const v = parsed.data;
    const id = cfg.getId(v);
    if (existingIds.has(up(id))) {
      out.push({ ...base, status: "exists", errors: [], warnings: [`Already exists (${cfg.idLabel} ${id}) — skipped.`] });
      continue;
    }
    if (existingEmails.has(v.email)) {
      out.push({ ...base, status: "exists", errors: [], warnings: [`Already exists (email ${v.email}) — skipped.`] });
      continue;
    }
    const keys = [`id:${up(id)}`, `email:${v.email}`];
    const earlier = dupes.find(keys);
    if (earlier !== undefined) {
      out.push({ ...base, status: "exists", errors: [], warnings: [`Duplicate of row ${earlier} in this file — skipped.`] });
      continue;
    }
    if (accounts.has(v.email)) {
      out.push({ ...base, status: "invalid", errors: [`Email ${v.email} is already used by another login account.`] });
      continue;
    }
    dupes.add(keys, r.rowNumber);
    out.push({ ...base, status: "add", errors: [], data: v });
  }
  return out;
}

export async function validateStudentFile(file: File, supabase: ServerSupabase) {
  const { data: years } = await supabase.from("year_levels").select("id, name, sort_order, is_active");
  const yearByName = new Map((years ?? []).map((y) => [low(y.name), y]));
  const yearByOrder = new Map((years ?? []).map((y) => [String(y.sort_order), y]));
  return validatePeople<StudentInput>(file, supabase, {
    columns: STUDENT_COLUMNS,
    required: ["student_number", "first_name", "last_name", "email", "program", "year_level"],
    idKey: "student_number",
    idLabel: "Student ID",
    schema: studentSchema,
    getId: (v) => v.student_number,
    findExisting: async (ids, emails) => {
      const [a, b] = await Promise.all([
        inChunks(ids, 200, async (c) => (await supabase.from("students").select("student_number").in("student_number", c)).data ?? []),
        inChunks(emails, 200, async (c) => (await supabase.from("students").select("email").in("email", c)).data ?? []),
      ]);
      return { ids: a.map((r) => r.student_number), emails: b.map((r) => r.email) };
    },
    toInput: (v, programs) => {
      const lookupErrors: Record<string, string> = {};
      const program = resolveProgram(v.program ?? "", programs);
      if (program.error) lookupErrors.program_id = program.error;
      let yearId = "";
      const yl = (v.year_level ?? "").trim();
      if (yl) {
        const y = yearByName.get(low(yl)) ?? yearByOrder.get(yl.replace(/\D/g, ""));
        if (!y) lookupErrors.year_level_id = `Year level "${yl}" does not exist.`;
        else if (!y.is_active) lookupErrors.year_level_id = `Year level ${y.name} is inactive.`;
        else yearId = y.id;
      }
      return {
        lookupErrors,
        input: {
          student_number: v.student_number ?? "", first_name: v.first_name ?? "", middle_name: v.middle_name ?? "",
          last_name: v.last_name ?? "", email: v.email ?? "", program_id: program.id, year_level_id: yearId,
        },
      };
    },
  });
}

export function validateFacultyFile(file: File, supabase: ServerSupabase) {
  return validatePeople<FacultyInput>(file, supabase, {
    columns: FACULTY_COLUMNS,
    required: ["faculty_number", "first_name", "last_name", "email", "program"],
    idKey: "faculty_number",
    idLabel: "Faculty ID",
    schema: facultySchema,
    getId: (v) => v.faculty_number,
    findExisting: async (ids, emails) => {
      const [a, b] = await Promise.all([
        inChunks(ids, 200, async (c) => (await supabase.from("faculty").select("faculty_number").in("faculty_number", c)).data ?? []),
        inChunks(emails, 200, async (c) => (await supabase.from("faculty").select("email").in("email", c)).data ?? []),
      ]);
      return { ids: a.map((r) => r.faculty_number), emails: b.map((r) => r.email) };
    },
    toInput: (v, programs) => {
      const lookupErrors: Record<string, string> = {};
      const program = resolveProgram(v.program ?? "", programs);
      if (program.error) lookupErrors.program_id = program.error;
      return {
        lookupErrors,
        input: {
          faculty_number: v.faculty_number ?? "", first_name: v.first_name ?? "", middle_name: v.middle_name ?? "",
          last_name: v.last_name ?? "", email: v.email ?? "", program_id: program.id,
          birthday: normalizeDate(v.birthday ?? ""), date_started: normalizeDate(v.date_started ?? ""),
        },
      };
    },
  });
}
