import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { parseSchoolYear, parseSemester, parseSpreadsheet } from "./parse";
import type { PreviewRow } from "./course";

export const EVALUATION_COLUMNS: Record<string, string[]> = {
  student_id: ["studentid", "studentnumber", "studentno", "idnumber"],
  subject_code: ["coursenumber", "courseno", "subjectcode", "code", "coursecode"],
  faculty_id: ["facultyid", "teacherid", "instructorid", "facultynumber", "facultyno"],
  school_year: ["schoolyear", "sy", "academicyear"],
  semester: ["semester", "sem", "term"],
  section: ["section", "block"],
  question: ["question", "questiontitle", "questioncode", "item"],
  rating: ["rating", "score", "answer"],
  comment: ["comment", "comments", "suggestion", "suggestions"],
  submitted_at: ["submittedat", "datesubmitted", "submitted", "date"],
};
const REQUIRED = ["student_id", "subject_code", "faculty_id", "school_year", "semester", "question", "rating"];

export type EvaluationPayloadRow = {
  student_number: string; subject_code: string; faculty_number: string; start_year: number; semester: number;
  section: string; question_id: string; rating: number; comment: string | null; submitted_at: string | null;
};

export type EvaluationValidation = {
  rows: PreviewRow[];
  payload: EvaluationPayloadRow[];
  summary: { total: number; valid: number; errors: number; warnings: number; evaluations: number; skippedExisting: number; incomplete: number };
};

const up = (s: string) => s.trim().toUpperCase();

export async function validateEvaluationFile(file: File, supabase: ServerSupabase, scaleMax: number): Promise<EvaluationValidation> {
  const { rows } = await parseSpreadsheet(file, EVALUATION_COLUMNS, REQUIRED, 50000);

  const [{ data: periods }, { data: questions }] = await Promise.all([
    supabase.from("academic_periods").select("id, start_year, semester"),
    supabase.from("questions").select("id, title, content, is_required, is_active"),
  ]);
  const periodMap = new Map((periods ?? []).map((p) => [`${p.start_year}-${p.semester}`, p.id]));
  const byTitle = new Map<string, string[]>();
  const byContent = new Map<string, string>();
  for (const q of questions ?? []) {
    const t = q.title.trim().toLowerCase();
    byTitle.set(t, [...(byTitle.get(t) ?? []), q.id]);
    byContent.set(q.content.trim().toLowerCase(), q.id);
  }
  const requiredIds = new Set((questions ?? []).filter((q) => q.is_required && q.is_active).map((q) => q.id));

  const periodIds = [...new Set(rows.map((r) => {
    const y = parseSchoolYear(r.values.school_year ?? ""); const s = parseSemester(r.values.semester ?? "");
    return y && s ? periodMap.get(`${y}-${s}`) : undefined;
  }).filter(Boolean))] as string[];
  const offerings = new Map<string, string>();
  if (periodIds.length) {
    const { data } = await supabase.from("offering_overview").select("id, subject_code, faculty_number, academic_period_id, section").in("academic_period_id", periodIds);
    for (const o of data ?? []) offerings.set(`${up(o.subject_code!)}|${up(o.faculty_number!)}|${o.academic_period_id}|${up(o.section ?? "")}`, o.id!);
  }
  const studentNumbers = [...new Set(rows.map((r) => up(r.values.student_id ?? "")).filter(Boolean))];
  const students = new Map<string, string>();
  for (let i = 0; i < studentNumbers.length; i += 200) {
    const { data } = await supabase.from("students").select("id, student_number").in("student_number", studentNumbers.slice(i, i + 200));
    for (const s of data ?? []) students.set(up(s.student_number), s.id);
  }
  const existingAttempts = new Set<string>();
  const offIds = [...new Set(offerings.values())];
  for (let i = 0; i < offIds.length; i += 200) {
    const { data } = await supabase.from("evaluation_attempts").select("offering_id, student_id").in("offering_id", offIds.slice(i, i + 200));
    for (const a of data ?? []) existingAttempts.add(`${a.offering_id}|${a.student_id}`);
  }

  const out: PreviewRow[] = [];
  const payload: EvaluationPayloadRow[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, { questions: Set<string>; skipped: boolean }>();

  for (const r of rows) {
    const v = r.values;
    const errors: string[] = [];
    const warnings: string[] = [];
    const stu = up(v.student_id ?? "");
    const code = up(v.subject_code ?? "");
    const fac = up(v.faculty_id ?? "");
    const section = up(v.section ?? "");
    const year = parseSchoolYear(v.school_year ?? "");
    const sem = parseSemester(v.semester ?? "");
    const rating = Number(v.rating);

    if (!stu) errors.push("Student ID is required.");
    else if (!students.has(stu)) errors.push(`Student ID ${stu} does not exist.`);
    if (!code) errors.push("Course Number is required.");
    if (!fac) errors.push("Faculty ID is required.");
    if (!year) errors.push(`Invalid School Year "${v.school_year}".`);
    if (!sem) errors.push(`Invalid Semester "${v.semester}".`);
    const periodId = year && sem ? periodMap.get(`${year}-${sem}`) : undefined;
    if (year && sem && !periodId) errors.push(`No survey schedule exists for S.Y. ${year}-${year + 1} semester ${sem}.`);
    const offeringId = periodId ? offerings.get(`${code}|${fac}|${periodId}|${section}`) : undefined;
    if (periodId && code && fac && !offeringId) errors.push(`No class ${code}${section ? ` (${section})` : ""} taught by ${fac} exists in that semester. Import the course file first.`);

    const qKey = (v.question ?? "").trim().toLowerCase();
    let questionId: string | undefined;
    const titleMatches = byTitle.get(qKey);
    if (titleMatches?.length === 1) questionId = titleMatches[0];
    else if (titleMatches && titleMatches.length > 1) errors.push(`Question title "${v.question}" is ambiguous; use the full question text.`);
    else questionId = byContent.get(qKey);
    if (!qKey) errors.push("Question is required.");
    else if (!questionId && !titleMatches) errors.push(`Question "${v.question.slice(0, 60)}" does not match any question title or text.`);

    if (!Number.isInteger(rating) || rating < 1 || rating > scaleMax) errors.push(`Rating must be a whole number from 1 to ${scaleMax}.`);

    let submittedAt: string | null = null;
    if (v.submitted_at) {
      const d = new Date(v.submitted_at);
      if (Number.isNaN(d.getTime())) errors.push(`Invalid submitted date "${v.submitted_at}".`);
      else if (d.getTime() > Date.now()) errors.push("Submitted date cannot be in the future.");
      else submittedAt = d.toISOString();
    }

    const dupKey = `${stu}|${offeringId}|${questionId}`;
    if (questionId && offeringId && seen.has(dupKey)) errors.push("Duplicate row: the same student already rated this question for this class.");
    seen.add(dupKey);

    if (!errors.length && offeringId && questionId) {
      const studentId = students.get(stu)!;
      const gk = `${offeringId}|${studentId}`;
      const g = groups.get(gk) ?? { questions: new Set<string>(), skipped: existingAttempts.has(gk) };
      g.questions.add(questionId);
      groups.set(gk, g);
      if (g.skipped) warnings.push("An evaluation already exists for this student and class — it will be preserved (skipped).");
      payload.push({
        student_number: stu, subject_code: code, faculty_number: fac, start_year: year!, semester: sem!, section,
        question_id: questionId, rating, comment: v.comment?.trim() ? v.comment.trim().slice(0, 3000) : null, submitted_at: submittedAt,
      });
    }
    out.push({ row: r.rowNumber, cells: v, errors, warnings });
  }

  let incomplete = 0;
  for (const g of groups.values()) {
    if (!g.skipped && [...requiredIds].some((id) => !g.questions.has(id))) incomplete++;
  }

  return {
    rows: out,
    payload,
    summary: {
      total: out.length,
      valid: out.filter((r) => !r.errors.length).length,
      errors: out.filter((r) => r.errors.length).length,
      warnings: out.filter((r) => r.warnings.length).length,
      evaluations: [...groups.values()].filter((g) => !g.skipped).length,
      skippedExisting: [...groups.values()].filter((g) => g.skipped).length,
      incomplete,
    },
  };
}
