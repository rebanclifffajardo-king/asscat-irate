import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPeriods, getPrograms } from "@/lib/data/lookups";

/** Options for the analytics filter bar (school years derive from schedules). */
export async function getFilterOptions(opts: { faculty?: boolean; subjects?: boolean } = {}) {
  const supabase = await createClient();
  const [periods, departments, programs, faculty, subjects] = await Promise.all([
    getPeriods(),
    getDepartments(),
    getPrograms(),
    opts.faculty ? supabase.from("faculty_overview").select("id, sort_name, faculty_number").order("sort_name") : Promise.resolve({ data: null }),
    opts.subjects ? supabase.from("subjects").select("id, code, title").order("code") : Promise.resolve({ data: null }),
  ]);
  const years = [...new Set(periods.map((p) => p.start_year))].sort((a, b) => b - a);
  return {
    periods,
    years: years.map((y) => ({ value: String(y), label: `S.Y. ${y}-${y + 1}` })),
    departments: departments.map((d) => ({ value: d.id, label: d.code })),
    programs: programs.map((p) => ({ value: p.id, label: p.code })),
    faculty: faculty.data?.map((f) => ({ value: f.id!, label: `${f.sort_name} (${f.faculty_number})` })),
    subjects: subjects.data?.map((s) => ({ value: s.id, label: `${s.code} – ${s.title}` })),
  };
}
