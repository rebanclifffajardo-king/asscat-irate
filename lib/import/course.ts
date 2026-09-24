import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { parseSchoolYear, parseSemester, parseSpreadsheet } from "./parse";

export const COURSE_COLUMNS: Record<string, string[]> = {
  subject_code: ["subjectcode", "code", "coursecode"],
  subject_title: ["subjecttitle", "title", "subjectname", "descriptivetitle", "coursetitle"],
  faculty_id: ["facultyid", "teacherid", "instructorid", "facultynumber", "facultyno"],
  program: ["program", "programcode"],
  department: ["department", "departmentcode", "college"],
  student_id: ["studentid", "studentnumber", "studentno", "idnumber"],
  school_year: ["schoolyear", "sy", "academicyear"],
  semester: ["semester", "sem", "term"],
  section: ["section", "block"],
};
const REQUIRED = ["subject_code", "subject_title", "faculty_id", "program", "student_id", "school_year", "semester"];

export type PreviewRow = {
  row: number;
  cells: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export type CoursePayloadRow = {
  subject_code: string; subject_title: string; faculty_number: string; program_code: string;
  student_number: string; start_year: number; semester: number; section: string;
};

export type CourseValidation = {
  rows: PreviewRow[];
  payload: CoursePayloadRow[];
  summary: { total: number; valid: number; errors: number; warnings: number; newSubjects: number; newClasses: number; newEnrollments: number; alreadyEnrolled: number };
};

const up = (s: string) => s.trim().toUpperCase();

/** Parses + validates a course file against the database (read-only). */
export async function validateCourseFile(file: File, supabase: ServerSupabase): Promise<CourseValidation> {
  const { rows } = await parseSpreadsheet(file, COURSE_COLUMNS, REQUIRED, 20000);

  const [{ data: faculty }, { data: programs }, { data: periods }, { data: subjects }] = await Promise.all([
    supabase.from("faculty").select("id, faculty_number, is_active"),
    supabase.from("program_overview").select("id, code, department_code, is_active"),
    supabase.from("academic_periods").select("id, start_year, semester"),
    supabase.from("subjects").select("id, code, title"),
  ]);
  const studentNumbers = [...new Set(rows.map((r) => up(r.values.student_id ?? "")).filter(Boolean))];
  const students = new Map<string, { id: string; is_active: boolean }>();
  for (let i = 0; i < studentNumbers.length; i += 200) {
    const { data } = await supabase.from("students").select("id, student_number, is_active").in("student_number", studentNumbers.slice(i, i + 200));
    for (const s of data ?? []) students.set(up(s.student_number), { id: s.id, is_active: s.is_active });
  }
  const facultyMap = new Map((faculty ?? []).map((f) => [up(f.faculty_number), f]));
  const programMap = new Map((programs ?? []).map((p) => [up(p.code!), p]));
  const periodMap = new Map((periods ?? []).map((p) => [`${p.start_year}-${p.semester}`, p.id]));
  const subjectMap = new Map((subjects ?? []).map((s) => [up(s.code), s]));

  // Existing offerings/enrollments in the referenced periods (to report what is new).
  const periodIds = [...new Set(rows.map((r) => {
    const y = parseSchoolYear(r.values.school_year ?? ""); const s = parseSemester(r.values.semester ?? "");
    return y && s ? periodMap.get(`${y}-${s}`) : undefined;
  }).filter(Boolean))] as string[];
  const offeringKey = new Map<string, string>();
  if (periodIds.length) {
    const { data: offs } = await supabase.from("offering_overview").select("id, subject_code, faculty_number, academic_period_id, section").in("academic_period_id", periodIds);
    for (const o of offs ?? []) offeringKey.set(`${up(o.subject_code!)}|${up(o.faculty_number!)}|${o.academic_period_id}|${up(o.section ?? "")}`, o.id!);
  }
  const existingEnrollments = new Set<string>();
  const offeringIds = [...offeringKey.values()];
  for (let i = 0; i < offeringIds.length; i += 300) {
    const { data } = await supabase.from("subject_enrollments").select("offering_id, student_id").in("offering_id", offeringIds.slice(i, i + 300));
    for (const e of data ?? []) existingEnrollments.add(`${e.offering_id}|${e.student_id}`);
  }

  const seen = new Set<string>();
  const newSubjects = new Set<string>();
  const newClasses = new Set<string>();
  const out: PreviewRow[] = [];
  const payload: CoursePayloadRow[] = [];
  let newEnrollments = 0;
  let alreadyEnrolled = 0;

  for (const r of rows) {
    const v = r.values;
    const errors: string[] = [];
    const warnings: string[] = [];
    const code = up(v.subject_code ?? "");
    const title = (v.subject_title ?? "").trim();
    const fac = up(v.faculty_id ?? "");
    const prog = up(v.program ?? "");
    const dept = up(v.department ?? "");
    const stu = up(v.student_id ?? "");
    const section = up(v.section ?? "");
    const year = parseSchoolYear(v.school_year ?? "");
    const sem = parseSemester(v.semester ?? "");

    if (!code) errors.push("Subject Code is required.");
    else if (code.length > 30) errors.push("Subject Code is too long.");
    if (!title) errors.push("Subject Title is required.");
    if (section.length > 30) errors.push("Section is too long.");

    const f = facultyMap.get(fac);
    if (!fac) errors.push("Faculty ID is required.");
    else if (!f) errors.push(`Faculty ID ${fac} does not exist.`);
    else if (!f.is_active) warnings.push(`Faculty ${fac} is inactive.`);

    const p = programMap.get(prog);
    if (!prog) errors.push("Program is required.");
    else if (!p) errors.push(`Program ${prog} does not exist.`);
    else if (dept && up(p.department_code!) !== dept) errors.push(`Program ${prog} belongs to ${p.department_code}, not ${dept}.`);

    const s = students.get(stu);
    if (!stu) errors.push("Student ID is required.");
    else if (!s) errors.push(`Student ID ${stu} does not exist.`);
    else if (!s.is_active) warnings.push(`Student ${stu} is inactive.`);

    if (!year) errors.push(`Invalid School Year "${v.school_year}". Use e.g. 2026-2027.`);
    if (!sem) errors.push(`Invalid Semester "${v.semester}". Use 1st or 2nd.`);
    const periodId = year && sem ? periodMap.get(`${year}-${sem}`) : undefined;
    if (year && sem && !periodId) errors.push(`No survey schedule exists for S.Y. ${year}-${year + 1} semester ${sem}.`);

    const existingSubject = subjectMap.get(code);
    if (existingSubject && title && existingSubject.title.toLowerCase() !== title.toLowerCase()) {
      warnings.push(`Existing subject ${code} is titled "${existingSubject.title}"; the existing title is kept.`);
    }

    const dupKey = `${code}|${fac}|${year}|${sem}|${section}|${stu}`;
    if (seen.has(dupKey)) errors.push("Duplicate row: this student already appears for the same class in this file.");
    seen.add(dupKey);

    if (!errors.length && periodId && s) {
      if (!existingSubject) newSubjects.add(code);
      const offId = offeringKey.get(`${code}|${fac}|${periodId}|${section}`);
      if (!offId) newClasses.add(`${code}|${fac}|${periodId}|${section}`);
      if (offId && existingEnrollments.has(`${offId}|${s.id}`)) {
        warnings.push("Already enrolled — will be skipped.");
        alreadyEnrolled++;
      } else newEnrollments++;
      payload.push({ subject_code: code, subject_title: title, faculty_number: fac, program_code: prog, student_number: stu, start_year: year!, semester: sem!, section });
    }

    out.push({ row: r.rowNumber, cells: { ...v, school_year: v.school_year, semester: v.semester }, errors, warnings });
  }

  return {
    rows: out,
    payload,
    summary: {
      total: out.length,
      valid: out.filter((r) => !r.errors.length).length,
      errors: out.filter((r) => r.errors.length).length,
      warnings: out.filter((r) => r.warnings.length).length,
      newSubjects: newSubjects.size,
      newClasses: newClasses.size,
      newEnrollments,
      alreadyEnrolled,
    },
  };
}
