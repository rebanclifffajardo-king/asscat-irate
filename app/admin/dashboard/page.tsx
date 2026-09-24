import type { Metadata } from "next";
import { after } from "next/server";
import { BookOpenCheck, Building2, CalendarDays, CheckCircle2, Clock, GraduationCap, Layers, Percent, Star, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { readParams } from "@/lib/url";
import { completionRate, getAdminAnalytics, periodFilterLabel, resolveAnalyticsFilters } from "@/lib/analytics/admin";
import { getSettings } from "@/lib/data/lookups";
import { formatDate, formatNumber, formatRating } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyticsCard, StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ratingLabel } from "@/components/ui/rating-display";
import { ChartCard } from "@/components/charts/chart-card";
import { DistributionChart, SimpleBarChart, TrendChart } from "@/components/charts/charts";
import { AnalyticsFilters } from "@/components/reports/analytics-filters";
import { getFilterOptions } from "@/components/reports/filter-options";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: PageProps<"/admin/dashboard">) {
  const params = await readParams(searchParams);
  const options = await getFilterOptions();
  const f = resolveAnalyticsFilters(params, options.periods);
  const [a, settings] = await Promise.all([getAdminAnalytics(f), getSettings()]);
  const current = options.periods.find((p) => p.is_current);
  const scale = settings.rating_scale;

  // Idempotent time-based notifications (period started / closing / closed).
  // (The client is created here: cookies() cannot be read inside after().)
  const supabase = await createClient();
  after(async () => {
    await supabase.rpc("generate_scheduled_notifications");
  });

  const k = a.kpis;
  const pending = k.expected - k.completed;
  const rate = completionRate(k.completed, k.expected);

  const trend = a.submissions_by_date.reduce<{ day: string; total: number }[]>(
    (acc, d) => [...acc, { day: formatDate(d.day, { month: "short", day: "numeric", year: undefined }), total: (acc.at(-1)?.total ?? 0) + d.count }],
    [],
  );
  const participation = a.participation_by_program.map((p) => ({ code: p.code, rate: completionRate(p.completed, p.expected) }));

  return (
    <>
      <PageHeader title="Dashboard" description={periodFilterLabel(f)} breadcrumbs={[{ label: "Home" }, { label: "Dashboard" }]} />
      <AnalyticsFilters
        values={{ sy: f.sy ? String(f.sy) : "", sem: f.sem ? String(f.sem) : "", department: f.department ?? "", program: f.program ?? "", faculty: "", subject: "" }}
        years={options.years}
        departments={options.departments}
        programs={options.programs}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={formatNumber(k.total_students)} icon={<GraduationCap />} tone="info" href="/admin/students" />
        <StatCard label="Total Faculty" value={formatNumber(k.total_faculty)} icon={<Users />} tone="brand" href="/admin/faculty" />
        <StatCard label="Total Programs" value={formatNumber(k.total_programs)} icon={<Layers />} tone="warning" href="/admin/settings?tab=programs" />
        <StatCard label="Total Departments" value={formatNumber(k.total_departments)} icon={<Building2 />} tone="danger" href="/admin/settings?tab=departments" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnalyticsCard
          label="Current Evaluation Period"
          value={<span className="text-base">{current?.label ?? "Not set"}</span>}
          icon={<CalendarDays />}
          tone="primary"
          hint={current ? <StatusBadge status={current.status === "closed" ? "expired" : current.status} label={current.status === "active" ? `Open until ${formatDate(current.close_at)}` : undefined} /> : undefined}
        />
        <AnalyticsCard label="Active Subjects / Evaluations" value={formatNumber(k.offerings)} icon={<BookOpenCheck />} tone="info" hint={`${k.faculty_evaluated} faculty evaluated`} />
        <AnalyticsCard label="Average Faculty Rating" value={`${formatRating(k.average_rating)} / ${scale.length}`} icon={<Star />} tone="warning" hint={ratingLabel(k.average_rating, scale)} />
        <AnalyticsCard label="Completed Evaluations" value={formatNumber(k.completed)} icon={<CheckCircle2 />} tone="brand" hint={`of ${formatNumber(k.expected)} expected`} />
        <AnalyticsCard label="Pending Evaluations" value={formatNumber(pending)} icon={<Clock />} tone="danger" hint={`${formatNumber(k.in_progress)} in progress · ${formatNumber(k.not_started)} not started`} />
        <AnalyticsCard label="Overall Completion Rate" value={`${rate}%`} icon={<Percent />} tone="brand" progress={rate} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Evaluation completion trend" description="Cumulative submitted evaluations by date" empty={!trend.length}
          table={{ columns: ["Date", "Submitted", "Cumulative"], rows: a.submissions_by_date.map((d, i) => [formatDate(d.day), d.count, trend[i].total]) }}>
          <TrendChart data={trend} xKey="day" series={[{ key: "total", label: "Completed evaluations" }]} format="count" />
        </ChartCard>
        <ChartCard title="Evaluation rating distribution" description={`Share of answers per rating (1–${scale.length})`} empty={!a.distribution.length}
          table={{ columns: ["Rating", "Responses"], rows: a.distribution.map((d) => [`${d.rating} – ${scale[d.rating - 1]?.label ?? ""}`, d.count]) }}>
          <DistributionChart data={a.distribution} labels={scale.map((s) => s.label)} />
        </ChartCard>
        <ChartCard title="Evaluations per department" description="Completed evaluations" empty={!a.by_department.length}
          table={{ columns: ["Department", "Completed", "Expected", "Average"], rows: a.by_department.map((d) => [d.code, d.evaluations, d.expected, formatRating(d.average)]) }}>
          <SimpleBarChart data={a.by_department} xKey="code" yKey="evaluations" name="Completed evaluations" format="count" />
        </ChartCard>
        <ChartCard title="Highest-rated categories" description="Average rating per category" empty={!a.categories.length}
          table={{ columns: ["Category", "Average", "Responses"], rows: a.categories.map((c) => [c.name, formatRating(c.average), c.responses]) }}>
          <SimpleBarChart data={a.categories} xKey="name" yKey="average" name="Average rating" horizontal max={scale.length} />
        </ChartCard>
        <ChartCard title="Semester participation by program" description="Completion rate of expected evaluations" className="lg:col-span-2" empty={!participation.length}
          table={{ columns: ["Program", "Completed", "Expected", "Completion"], rows: a.participation_by_program.map((p) => [p.code, p.completed, p.expected, `${completionRate(p.completed, p.expected)}%`]) }}>
          <SimpleBarChart data={participation} xKey="code" yKey="rate" name="Completion rate" format="percent" max={100} />
        </ChartCard>
      </div>
    </>
  );
}
