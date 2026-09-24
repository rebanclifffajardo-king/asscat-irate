import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, FileDown, FileSpreadsheet, ListChecks, Printer, Star, Users } from "lucide-react";
import { readParams } from "@/lib/url";
import { completionRate, getAdminAnalytics, periodFilterLabel, resolveAnalyticsFilters } from "@/lib/analytics/admin";
import { getSettings } from "@/lib/data/lookups";
import { formatDate, formatNumber, formatRating } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { AnalyticsCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { ratingLabel } from "@/components/ui/rating-display";
import { ChartCard } from "@/components/charts/chart-card";
import { DistributionChart, SimpleBarChart, TrendChart } from "@/components/charts/charts";
import { AnalyticsFilters } from "@/components/reports/analytics-filters";
import { getFilterOptions } from "@/components/reports/filter-options";
import { CompletionTable, QuestionAveragesTable, RespondentsTable, TopFacultyTable } from "@/components/reports/report-tables";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const params = await readParams(searchParams);
  const options = await getFilterOptions({ faculty: true, subjects: true });
  const f = resolveAnalyticsFilters(params, options.periods);
  const [a, settings] = await Promise.all([getAdminAnalytics(f), getSettings()]);
  const scale = settings.rating_scale;
  const max = scale.length;
  const k = a.kpis;
  const rate = completionRate(k.completed, k.expected);
  const syLabel = f.sy ? `S.Y. ${f.sy}-${f.sy + 1}` : "All school years";

  const qs = new URLSearchParams({ sy: f.sy ? String(f.sy) : "all", sem: f.sem ? String(f.sem) : "all" });
  for (const key of ["department", "program", "faculty", "subject"] as const) if (f[key]) qs.set(key, f[key]!);

  const cats = a.categories;
  const mostCommon = a.distribution.reduce<{ rating: number; count: number } | null>((m, d) => (!m || d.count > m.count ? d : m), null);

  // Pivot subject trends into one row per period.
  const subjectCodes = [...new Set(a.subject_trends.map((t) => t.subject_code))];
  const trendPeriods = [...new Map(a.subject_trends.map((t) => [t.label, t])).values()].sort((x, y) => x.start_year - y.start_year || x.semester - y.semester);
  const subjectTrend = trendPeriods.map((p) => ({
    label: `${p.semester === 1 ? "1st" : "2nd"} ${p.start_year}`,
    ...Object.fromEntries(a.subject_trends.filter((t) => t.label === p.label).map((t) => [t.subject_code, t.average])),
  }));
  const periodTrend = a.rating_by_period.map((p) => ({ label: `${p.semester === 1 ? "1st" : "2nd"} ${p.start_year}-${String(p.start_year + 1).slice(2)}`, average: p.average }));
  const selectedFaculty = options.faculty?.find((x) => x.value === f.faculty)?.label;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Descriptive analytics · ${periodFilterLabel(f)}`}
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Reports" }]}
        actions={
          <>
            <a href={`/api/reports/export?format=csv&${qs}`} className={buttonClasses("secondary")}><FileDown className="h-4 w-4" /> CSV</a>
            <a href={`/api/reports/export?format=xlsx&${qs}`} className={buttonClasses("secondary")}><FileSpreadsheet className="h-4 w-4" /> XLSX</a>
            <Link href={`/print/reports?${qs}`} target="_blank" className={buttonClasses()}><Printer className="h-4 w-4" /> Printable report</Link>
          </>
        }
      />
      <AnalyticsFilters
        values={{ sy: f.sy ? String(f.sy) : "", sem: f.sem ? String(f.sem) : "", department: f.department ?? "", program: f.program ?? "", faculty: f.faculty ?? "", subject: f.subject ?? "" }}
        years={options.years}
        departments={options.departments}
        programs={options.programs}
        faculty={options.faculty}
        subjects={options.subjects}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard label="Overall average rating" value={`${formatRating(k.average_rating)} / ${max}`} icon={<Star />} tone="warning" hint={ratingLabel(k.average_rating, scale)} />
        <AnalyticsCard label="Evaluation completion" value={`${rate}%`} icon={<ListChecks />} tone="brand" progress={rate} hint={`${formatNumber(k.completed)} of ${formatNumber(k.expected)} expected`} />
        <AnalyticsCard label="Highest-rated category" value={<span className="text-base">{cats[0]?.name ?? "—"}</span>} icon={<ArrowUpCircle />} tone="info" hint={cats[0] ? formatRating(cats[0].average) : undefined} />
        <AnalyticsCard label="Lowest-rated category" value={<span className="text-base">{cats.at(-1)?.name ?? "—"}</span>} icon={<ArrowDownCircle />} tone="danger" hint={cats.at(-1) ? formatRating(cats.at(-1)!.average) : undefined} />
        <AnalyticsCard label="Incomplete evaluations" value={formatNumber(k.expected - k.completed)} icon={<ListChecks />} tone="danger" hint={`${formatNumber(k.in_progress)} in progress · ${formatNumber(k.not_started)} not started`} />
        <AnalyticsCard label="Most common rating" value={mostCommon ? `${mostCommon.rating} – ${scale[mostCommon.rating - 1]?.label ?? ""}` : "—"} icon={<Star />} tone="primary" hint={mostCommon ? `${formatNumber(mostCommon.count)} answers` : undefined} />
        <AnalyticsCard label="Respondents" value={formatNumber(k.respondents)} icon={<Users />} tone="info" hint={`${k.faculty_evaluated} faculty · ${k.offerings} classes`} />
        <AnalyticsCard label="Minimum respondents rule" value={`n ≥ ${a.min_respondents}`} icon={<Users />} tone="dark" hint={`${a.faculty_below_threshold} faculty below threshold (excluded from rankings)`} />
      </div>

      {selectedFaculty && <Alert tone="info" className="mt-4">Showing the historical performance of <strong>{selectedFaculty}</strong>. Trend charts cover every semester.</Alert>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="1. Overall evaluation rating per semester" description="Semester-to-semester average (all periods, other filters applied)" empty={!periodTrend.length}
          table={{ columns: ["Semester", "Average", "Respondents"], rows: a.rating_by_period.map((p) => [p.label, formatRating(p.average), p.respondents]) }}>
          <TrendChart data={periodTrend} xKey="label" series={[{ key: "average", label: "Average rating" }]} domain={[1, max]} />
        </ChartCard>

        <Card className="print-avoid">
          <CardHeader title="2. Top performing faculty" description={`Highest averages among faculty with at least ${a.min_respondents} completed evaluations`} />
          <TopFacultyTable a={a} scale={scale} />
        </Card>

        <ChartCard title={`3. Evaluation rating per department – ${syLabel}`} empty={!a.by_department.length}
          table={{ columns: ["Department", "Average", "Evaluations"], rows: a.by_department.map((d) => [`${d.code} – ${d.name}`, formatRating(d.average), d.evaluations]) }}>
          <SimpleBarChart data={a.by_department} xKey="code" yKey="average" name="Average rating" max={max} />
        </ChartCard>

        <Card className="print-avoid">
          <CardHeader title={`4. Percentage of evaluation completion – ${syLabel}`} description={`${formatNumber(k.completed)} completed · ${formatNumber(k.expected - k.completed)} pending · ${formatNumber(k.expected)} expected · ${rate}%`} />
          <CompletionTable rows={a.participation_by_department} label="Department" />
        </Card>

        <ChartCard title="5. Overall evaluation rating per school year" description="Long-term trend" empty={!a.rating_by_school_year.length}
          table={{ columns: ["School year", "Average", "Respondents"], rows: a.rating_by_school_year.map((p) => [p.school_year, formatRating(p.average), p.respondents]) }}>
          <TrendChart data={a.rating_by_school_year} xKey="school_year" series={[{ key: "average", label: "Average rating" }]} domain={[1, max]} />
        </ChartCard>

        <ChartCard title={`6. Total evaluations per department – ${syLabel}`} empty={!a.by_department.length}
          table={{ columns: ["Department", "Completed", "Expected"], rows: a.by_department.map((d) => [d.code, d.evaluations, d.expected]) }}>
          <SimpleBarChart data={a.by_department} xKey="code" yKey="evaluations" name="Completed evaluations" format="count" />
        </ChartCard>

        <ChartCard title="7. Average rating by faculty age range" description="Age computed from birthday at the time of each evaluation period" empty={!a.age_ranges.length}
          table={{ columns: ["Age range", "Average", "Faculty", "Respondents"], rows: a.age_ranges.map((r) => [r.label, formatRating(r.average), r.faculty, r.respondents]) }}>
          <SimpleBarChart data={a.age_ranges} xKey="label" yKey="average" name="Average rating" max={max} />
        </ChartCard>

        <ChartCard title="8. Average rating by years of service" description="Computed from date started at the time of each evaluation period" empty={!a.service_ranges.length}
          table={{ columns: ["Years of service", "Average", "Faculty", "Respondents"], rows: a.service_ranges.map((r) => [r.label, formatRating(r.average), r.faculty, r.respondents]) }}>
          <SimpleBarChart data={a.service_ranges} xKey="label" yKey="average" name="Average rating" max={max} />
        </ChartCard>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-gray-800">Additional descriptive analytics</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Average rating per category" description="Highest to lowest" empty={!cats.length}
          table={{ columns: ["Category", "Average", "Responses"], rows: cats.map((c) => [c.name, formatRating(c.average), c.responses]) }}>
          <SimpleBarChart data={cats} xKey="name" yKey="average" name="Average rating" horizontal max={max} />
        </ChartCard>
        <ChartCard title="Rating distribution" description={`Answers per rating (1–${max})`} empty={!a.distribution.length}
          table={{ columns: ["Rating", "Answers"], rows: a.distribution.map((d) => [`${d.rating} – ${scale[d.rating - 1]?.label ?? ""}`, d.count]) }}>
          <DistributionChart data={a.distribution} labels={scale.map((s) => s.label)} />
        </ChartCard>
        <Card className="print-avoid lg:col-span-2">
          <CardHeader title="Average score per question" />
          <QuestionAveragesTable a={a} />
        </Card>
        <ChartCard title="Department comparison" description="Average rating per department" empty={!a.by_department.length}
          table={{ columns: ["Department", "Average"], rows: a.by_department.map((d) => [d.code, formatRating(d.average)]) }}>
          <SimpleBarChart data={a.by_department} xKey="code" yKey="average" name="Average rating" horizontal max={max} />
        </ChartCard>
        <ChartCard title="Program comparison" description="Average rating per program (class program)" empty={!a.by_program.length}
          table={{ columns: ["Program", "Average", "Evaluations"], rows: a.by_program.map((p) => [p.code, formatRating(p.average), p.evaluations]) }}>
          <SimpleBarChart data={a.by_program} xKey="code" yKey="average" name="Average rating" horizontal max={max} />
        </ChartCard>
        <ChartCard title="Evaluation participation by program" description="Completion rate by the student's program" empty={!a.participation_by_program.length}
          table={{ columns: ["Program", "Completed", "Expected", "Completion"], rows: a.participation_by_program.map((p) => [p.code, p.completed, p.expected, `${completionRate(p.completed, p.expected)}%`]) }}>
          <SimpleBarChart data={a.participation_by_program.map((p) => ({ code: p.code, rate: completionRate(p.completed, p.expected) }))} xKey="code" yKey="rate" name="Completion rate" format="percent" max={100} />
        </ChartCard>
        <ChartCard title="Evaluation participation by department" description="Completion rate by the student's department" empty={!a.participation_by_department.length}
          table={{ columns: ["Department", "Completed", "Expected", "Completion"], rows: a.participation_by_department.map((p) => [p.code, p.completed, p.expected, `${completionRate(p.completed, p.expected)}%`]) }}>
          <SimpleBarChart data={a.participation_by_department.map((p) => ({ code: p.code, rate: completionRate(p.completed, p.expected) }))} xKey="code" yKey="rate" name="Completion rate" format="percent" max={100} />
        </ChartCard>
        <ChartCard title="Evaluation completion by year level" empty={!a.completion_by_year_level.length}
          table={{ columns: ["Year level", "Completed", "Expected", "Completion"], rows: a.completion_by_year_level.map((p) => [p.name, p.completed, p.expected, `${completionRate(p.completed, p.expected)}%`]) }}>
          <SimpleBarChart data={a.completion_by_year_level.map((p) => ({ name: p.name, rate: completionRate(p.completed, p.expected) }))} xKey="name" yKey="rate" name="Completion rate" format="percent" max={100} />
        </ChartCard>
        <Card className="print-avoid">
          <CardHeader title="Number of respondents per faculty" description="Completed vs. expected evaluations" />
          <RespondentsTable a={a} />
        </Card>
        <ChartCard title="Subject evaluation trends" description="Average rating over time for the five most-evaluated subjects" empty={!subjectTrend.length} className="lg:col-span-2"
          table={{ columns: ["Course Number", "Semester", "Average"], rows: a.subject_trends.map((t) => [t.subject_code, t.label, formatRating(t.average)]) }}>
          <TrendChart data={subjectTrend} xKey="label" series={subjectCodes.map((c) => ({ key: c, label: c }))} domain={[1, max]} height={300} />
        </ChartCard>
        <ChartCard title="Evaluation submission activity by date" description="Evaluations submitted per day" empty={!a.submissions_by_date.length} className="lg:col-span-2"
          table={{ columns: ["Date", "Submitted"], rows: a.submissions_by_date.map((d) => [formatDate(d.day), d.count]) }}>
          <SimpleBarChart data={a.submissions_by_date.map((d) => ({ day: formatDate(d.day, { month: "short", day: "numeric", year: undefined }), count: d.count }))} xKey="day" yKey="count" name="Submitted" format="count" />
        </ChartCard>
      </div>
    </>
  );
}
