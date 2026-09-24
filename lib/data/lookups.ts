import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SCALE, type ScalePoint } from "@/components/ui/rating-display";

export type PeriodRow = {
  id: string; label: string; school_year: string; start_year: number; semester: number;
  open_at: string; close_at: string; is_current: boolean; results_released_at: string | null; status: string;
};

export const getPeriods = cache(async (): Promise<PeriodRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("period_overview").select("*")
    .order("start_year", { ascending: false }).order("semester", { ascending: false });
  return (data ?? []) as PeriodRow[];
});

/** Resolve the `period` URL param; defaults to the current period (or latest). */
export async function resolvePeriod(param: string | undefined): Promise<{ periods: PeriodRow[]; period: PeriodRow | null }> {
  const periods = await getPeriods();
  const period = periods.find((p) => p.id === param) ?? periods.find((p) => p.is_current) ?? periods[0] ?? null;
  return { periods, period };
}

export const getDepartments = cache(async (activeOnly = false) => {
  const supabase = await createClient();
  let q = supabase.from("departments").select("id,code,name,is_active").order("code");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
});

export const getPrograms = cache(async (activeOnly = false) => {
  const supabase = await createClient();
  let q = supabase.from("program_overview").select("id,code,name,department_id,department_code,department_name,is_active").order("code");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []).map((p) => ({
    id: p.id!, code: p.code!, name: p.name!, department_id: p.department_id!,
    department_code: p.department_code!, department_name: p.department_name!, is_active: p.is_active!,
  }));
});

export const getYearLevels = cache(async (activeOnly = false) => {
  const supabase = await createClient();
  let q = supabase.from("year_levels").select("id,name,sort_order,is_active").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
});

export const getCategories = cache(async (activeOnly = false) => {
  const supabase = await createClient();
  let q = supabase.from("question_categories").select("id,name,is_active,sort_order").order("sort_order").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
});

export type AppSettings = {
  results_visibility: "immediate" | "after_close" | "manual";
  min_respondents: number;
  rating_scale: ScalePoint[];
  allow_comments: boolean;
  require_comments: boolean;
  deadline_reminder_days: number;
  institution_name: string;
  institution_address: string;
  system_name: string;
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("system_settings").select("key,value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    results_visibility: (map.results_visibility as AppSettings["results_visibility"]) ?? "after_close",
    min_respondents: Number(map.min_respondents ?? 3),
    rating_scale: (Array.isArray(map.rating_scale) ? map.rating_scale : DEFAULT_SCALE) as ScalePoint[],
    allow_comments: map.allow_comments !== false,
    require_comments: map.require_comments === true,
    deadline_reminder_days: Number(map.deadline_reminder_days ?? 3),
    institution_name: String(map.institution_name ?? "Agusan del Sur State College of Agriculture and Technology"),
    institution_address: String(map.institution_address ?? ""),
    system_name: String(map.system_name ?? "ASSCAT iRATE"),
  };
});
