import type { AdminAnalytics } from "./admin";
import { completionRate } from "./admin";

export type ReportSection = { title: string; columns: string[]; rows: (string | number | null)[][] };

const r2 = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(Number(n) * 100) / 100);

/** Flattens analytics into tabular sections for CSV/XLSX export. */
export function buildReportSections(a: AdminAnalytics, scaleLabels: string[]): ReportSection[] {
  const k = a.kpis;
  return [
    {
      title: "Summary", columns: ["Metric", "Value"], rows: [
        ["Average rating", r2(k.average_rating)], ["Completed evaluations", k.completed], ["Pending evaluations", k.expected - k.completed],
        ["In progress", k.in_progress], ["Not started", k.not_started], ["Total expected", k.expected],
        ["Completion %", completionRate(k.completed, k.expected)], ["Classes (subject offerings)", k.offerings],
        ["Faculty evaluated", k.faculty_evaluated], ["Minimum respondents for rankings", a.min_respondents],
      ],
    },
    { title: "Overall Evaluation Rating per Semester", columns: ["Semester", "Average", "Respondents"], rows: a.rating_by_period.map((p) => [p.label, r2(p.average), p.respondents]) },
    { title: "Top Performing Faculty", columns: ["Rank", "Faculty ID", "Faculty", "Department", "Average", "Evaluations"], rows: a.top_faculty.map((f, i) => [i + 1, f.faculty_number, f.name, f.department_code, r2(f.average), f.respondents]) },
    { title: "Evaluation Rating per Department", columns: ["Department", "Name", "Average", "Completed", "Expected"], rows: a.by_department.map((d) => [d.code, d.name, r2(d.average), d.evaluations, d.expected]) },
    { title: "Evaluation Completion per Department", columns: ["Department", "Completed", "Pending", "Expected", "Completion %"], rows: a.participation_by_department.map((d) => [d.code, d.completed, d.expected - d.completed, d.expected, completionRate(d.completed, d.expected)]) },
    { title: "Overall Evaluation Rating per School Year", columns: ["School Year", "Average", "Respondents"], rows: a.rating_by_school_year.map((p) => [p.school_year, r2(p.average), p.respondents]) },
    { title: "Average Rating by Faculty Age Range", columns: ["Age Range", "Average", "Faculty", "Respondents"], rows: a.age_ranges.map((r) => [r.label, r2(r.average), r.faculty, r.respondents]) },
    { title: "Average Rating by Years of Service", columns: ["Years of Service", "Average", "Faculty", "Respondents"], rows: a.service_ranges.map((r) => [r.label, r2(r.average), r.faculty, r.respondents]) },
    { title: "Average Rating per Category", columns: ["Category", "Average", "Responses"], rows: a.categories.map((c) => [c.name, r2(c.average), c.responses]) },
    { title: "Average Score per Question", columns: ["Category", "Question Code", "Question", "Average", "Responses"], rows: a.questions.map((q) => [q.category, q.title, q.content, r2(q.average), q.responses]) },
    { title: "Rating Distribution", columns: ["Rating", "Label", "Answers"], rows: a.distribution.map((d) => [d.rating, scaleLabels[d.rating - 1] ?? "", d.count]) },
    { title: "Program Comparison", columns: ["Program", "Average", "Evaluations"], rows: a.by_program.map((p) => [p.code, r2(p.average), p.evaluations]) },
    { title: "Participation by Program", columns: ["Program", "Completed", "Expected", "Completion %"], rows: a.participation_by_program.map((p) => [p.code, p.completed, p.expected, completionRate(p.completed, p.expected)]) },
    { title: "Completion by Year Level", columns: ["Year Level", "Completed", "Expected", "Completion %"], rows: a.completion_by_year_level.map((p) => [p.name, p.completed, p.expected, completionRate(p.completed, p.expected)]) },
    { title: "Respondents per Faculty", columns: ["Faculty", "Department", "Respondents", "Expected", "Average"], rows: a.faculty_respondents.map((f) => [f.name, f.department_code, f.respondents, f.expected, f.respondents >= a.min_respondents ? r2(f.average) : null]) },
    { title: "Subject Evaluation Trends", columns: ["Subject", "Semester", "Average"], rows: a.subject_trends.map((t) => [t.subject_code, t.label, r2(t.average)]) },
    { title: "Submission Activity by Date", columns: ["Date", "Submitted"], rows: a.submissions_by_date.map((d) => [d.day, d.count]) },
  ];
}

/** Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR). */
export function safeCell(v: string | number | null): string | number {
  if (v === null) return "";
  if (typeof v === "number") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
