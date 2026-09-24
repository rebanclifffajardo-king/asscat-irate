import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PeriodRow } from "@/lib/data/lookups";
import type { FlatParams } from "@/lib/url";
import { schoolYearLabel, semesterLabel } from "@/lib/format";

export type AdminAnalytics = {
  min_respondents: number;
  kpis: {
    total_students: number; total_faculty: number; total_programs: number; total_departments: number;
    offerings: number; expected: number; completed: number; in_progress: number; not_started: number;
    respondents: number; average_rating: number | null; faculty_evaluated: number;
  };
  rating_by_period: { label: string; start_year: number; semester: number; average: number; respondents: number }[];
  rating_by_school_year: { school_year: string; average: number; respondents: number }[];
  top_faculty: { id: string; name: string; faculty_number: string; department_code: string; department_name: string; average: number; respondents: number }[];
  faculty_below_threshold: number;
  faculty_respondents: { id: string; name: string; department_code: string; expected: number; respondents: number; average: number | null }[];
  by_department: { id: string; code: string; name: string; average: number | null; evaluations: number; expected: number }[];
  by_program: { id: string; code: string; name: string; average: number | null; evaluations: number }[];
  participation_by_program: { code: string; name: string; expected: number; completed: number }[];
  participation_by_department: { code: string; name: string; expected: number; completed: number }[];
  completion_by_year_level: { name: string; sort_order: number; expected: number; completed: number }[];
  categories: { name: string; average: number; responses: number }[];
  questions: { category: string; title: string; content: string; average: number; responses: number }[];
  distribution: { rating: number; count: number }[];
  age_ranges: { label: string; average: number; faculty: number; respondents: number }[];
  service_ranges: { label: string; average: number; faculty: number; respondents: number }[];
  subject_trends: { subject_code: string; label: string; start_year: number; semester: number; average: number }[];
  submissions_by_date: { day: string; count: number }[];
};

export type AnalyticsFilterState = {
  sy?: number; sem?: 1 | 2; periodId?: string;
  department?: string; program?: string; faculty?: string; subject?: string;
};

/**
 * Reads filters from URL params. With no explicit school year/semester the
 * current evaluation period is used (consistent with Survey and Dashboard);
 * "all" clears the period filter.
 */
export function resolveAnalyticsFilters(params: FlatParams, periods: PeriodRow[]): AnalyticsFilterState {
  const current = periods.find((p) => p.is_current) ?? periods[0];
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  let sy = params.sy === "all" ? undefined : params.sy ? Number(params.sy) : current?.start_year;
  if (sy !== undefined && !Number.isInteger(sy)) sy = undefined;
  const defaultSem = params.sy ? undefined : (current?.semester as 1 | 2 | undefined);
  const sem: 1 | 2 | undefined =
    params.sem === "all" ? undefined : params.sem === "1" ? 1 : params.sem === "2" ? 2 : defaultSem;
  const period = sy && sem ? periods.find((p) => p.start_year === sy && p.semester === sem) : undefined;
  return {
    sy, sem, periodId: period?.id,
    department: uuid(params.department), program: uuid(params.program), faculty: uuid(params.faculty), subject: uuid(params.subject),
  };
}

export async function getAdminAnalytics(f: AnalyticsFilterState): Promise<AdminAnalytics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics", {
    p_period_id: f.periodId,
    p_start_year: f.periodId ? undefined : f.sy,
    p_semester: f.periodId ? undefined : f.sem,
    p_department_id: f.department,
    p_program_id: f.program,
    p_faculty_id: f.faculty,
    p_subject_id: f.subject,
  });
  if (error) throw new Error(`Analytics failed: ${error.message}`);
  return data as unknown as AdminAnalytics;
}

export function periodFilterLabel(f: AnalyticsFilterState): string {
  if (!f.sy && !f.sem) return "All school years and semesters";
  if (f.sy && f.sem) return `${semesterLabel(f.sem)} of ${schoolYearLabel(f.sy)}`;
  if (f.sy) return `${schoolYearLabel(f.sy)} (both semesters)`;
  return `${semesterLabel(f.sem!)} (all school years)`;
}

export function completionRate(completed: number, expected: number) {
  return expected ? Math.round((completed / expected) * 1000) / 10 : 0;
}
