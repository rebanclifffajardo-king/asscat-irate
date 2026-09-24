import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CheckCircle2, MessageSquareText, Percent, Star } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readParams } from "@/lib/url";
import { getSettings } from "@/lib/data/lookups";
import { formatNumber, formatRating, percent } from "@/lib/format";
import type { FacultyAnalytics, FacultyOffering } from "@/lib/analytics/faculty";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AnalyticsCard } from "@/components/ui/stat-card";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { FilterSelect } from "@/components/ui/filter-select";
import { EvaluationProgress } from "@/components/ui/evaluation-progress";
import { RatingDisplay, ratingLabel } from "@/components/ui/rating-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ChartCard } from "@/components/charts/chart-card";
import { DistributionChart, SimpleBarChart, TrendChart } from "@/components/charts/charts";

export const metadata: Metadata = { title: "Dashboard" };

export default async function FacultyDashboard({ searchParams }: PageProps<"/faculty/dashboard">) {
  const user = await requireRole("faculty");
  const params = await readParams(searchParams);
  const supabase = await createClient();
  const [{ data: offeringsData }, settings, { data: current }] = await Promise.all([
    supabase.rpc("get_faculty_offerings"),
    getSettings(),
    supabase.from("academic_periods").select("id, label").eq("is_current", true).maybeSingle(),
  ]);
  const offerings = (offeringsData ?? []) as FacultyOffering[];
  const periods = [...new Map(offerings.map((o) => [o.period_id, { id: o.period_id, label: o.period_label }])).values()];
  const periodId = params.period === "all" ? undefined : periods.some((p) => p.id === params.period) ? params.period : current?.id;
  const offeringId = offerings.some((o) => o.offering_id === params.subject) ? params.subject : undefined;

  const { data: analyticsData } = await supabase.rpc("get_faculty_analytics", { p_period_id: periodId, p_offering_id: offeringId });
  const a = analyticsData as unknown as FacultyAnalytics;
  const scale = settings.rating_scale;
  const inScope = offerings.filter((o) => (!periodId || o.period_id === periodId) && (!offeringId || o.offering_id === offeringId));
  const periodLabel = periodId ? periods.find((p) => p.id === periodId)?.label ?? current?.label : "All semesters";
  const completion = percent(a.progress.completed, a.progress.enrolled);

  return (
    <>
      <PageHeader title="Dashboard" description={periodLabel} breadcrumbs={[{ label: "Home" }, { label: "Dashboard" }]} />

      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card outline="brand">
          <CardBody className="flex items-center gap-4">
            <FacultyAvatar name={user.displayName} src={user.avatarUrl} size="lg" className="ring-brand-100" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-gray-900">{user.displayName}</p>
              <p className="text-sm text-gray-600">{user.recordNumber} · {user.programCode}</p>
              <p className="text-sm text-gray-500">{user.departmentName}</p>
              <p className="mt-1 text-xs font-semibold text-brand-700">Current semester: {current?.label ?? "Not set"}</p>
            </div>
          </CardBody>
        </Card>
        <div className="grid gap-3 rounded-md bg-white p-3 shadow-card sm:grid-cols-2">
          <FilterSelect param="period" label="School year & semester" options={[{ value: "all", label: "All semesters" }, ...periods.map((p) => ({ value: p.id, label: p.label }))]}
            allLabel={current ? `${current.label} (current)` : "Current semester"} resetParams={["subject"]} />
          <FilterSelect param="subject" label="Subject" options={inScope.length || offeringId ? offerings.filter((o) => !periodId || o.period_id === periodId).map((o) => ({ value: o.offering_id, label: `${o.subject_code}${o.section ? ` (${o.section})` : ""} – ${o.subject_title}` })) : []}
            allLabel="All subjects" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard label="Subjects handled" value={formatNumber(a.progress.offerings)} icon={<BookOpen />} tone="info" hint={periodLabel} />
        <AnalyticsCard label="Evaluations received" value={formatNumber(a.progress.completed)} icon={<CheckCircle2 />} tone="brand" hint={`of ${formatNumber(a.progress.enrolled)} enrolled students`} />
        <AnalyticsCard label="Average rating" value={a.overall_average === null ? "—" : `${formatRating(a.overall_average)} / ${scale.length}`} icon={<Star />} tone="warning" hint={a.overall_average === null ? "No released results yet" : ratingLabel(a.overall_average, scale)} />
        <AnalyticsCard label="Evaluation completion" value={`${completion}%`} icon={<Percent />} tone="primary" progress={completion} />
      </div>

      {a.released_offerings < inScope.length && (
        <Alert tone="info" className="mt-4">
          Ratings include only classes whose results have been released and that have at least {a.min_respondents} respondents, to protect student anonymity.
          {settings.results_visibility === "after_close" && " Results are released automatically after the evaluation period closes."}
          {settings.results_visibility === "manual" && " Results are released by the administrator."}
        </Alert>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Overall evaluation rating" description="Released results in scope" empty={a.overall_average === null}>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-6xl font-bold tabular-nums text-gray-900">{formatRating(a.overall_average)}</p>
            <p className="mt-1 text-sm text-gray-500">out of {scale.length} · {ratingLabel(a.overall_average, scale)}</p>
            <RatingDisplay value={a.overall_average} max={scale.length} showLabel={false} size="md" className="mt-3" />
            <p className="mt-3 text-sm text-gray-600">{formatNumber(a.respondents)} respondents</p>
          </div>
        </ChartCard>
        <ChartCard title="Rating by category" empty={!a.categories.length}
          table={{ columns: ["Category", "Average", "Responses"], rows: a.categories.map((c) => [c.name, formatRating(c.average), c.responses]) }}>
          <SimpleBarChart data={a.categories} xKey="name" yKey="average" name="Average rating" horizontal max={scale.length} />
        </ChartCard>
        <ChartCard title="Rating by semester (historical)" description={offeringId ? "Same subject across semesters" : "All released classes"} empty={!a.history.length}
          table={{ columns: ["Semester", "Average", "Respondents"], rows: a.history.map((h) => [h.label, formatRating(h.average), h.respondents]) }}>
          <TrendChart data={a.history.map((h) => ({ label: `${h.semester === 1 ? "1st" : "2nd"} ${h.start_year}`, average: h.average }))} xKey="label" series={[{ key: "average", label: "Average rating" }]} domain={[1, scale.length]} />
        </ChartCard>
        <ChartCard title="Student feedback summary" description={`${formatNumber(a.comment_count)} anonymous comment(s) · rating distribution`} empty={!a.distribution.length}
          actions={<Link href="/faculty/results" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"><MessageSquareText className="h-4 w-4" /> Read comments</Link>}
          table={{ columns: ["Rating", "Answers"], rows: a.distribution.map((d) => [`${d.rating} – ${scale[d.rating - 1]?.label ?? ""}`, d.count]) }}>
          <DistributionChart data={a.distribution} labels={scale.map((s) => s.label)} />
        </ChartCard>
      </div>

      <Card className="mt-5">
        <CardHeader title="Subjects handled" description={periodLabel} />
        {inScope.length === 0 ? <EmptyState title="No subjects in this period" /> : (
          <ul className="divide-y divide-gray-100">
            {inScope.map((o) => (
              <li key={o.offering_id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_200px_170px_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{o.subject_code}{o.section ? ` (${o.section})` : ""} — {o.subject_title}</p>
                  <p className="text-xs text-gray-500">{o.period_label} · {o.program_code}</p>
                </div>
                <EvaluationProgress completed={o.completed} total={o.enrolled} compact />
                {o.average !== null ? <RatingDisplay value={o.average} max={scale.length} showLabel={false} />
                  : <StatusBadge status="hidden" label={!o.results_visible ? "Not yet released" : `Needs ≥ ${a.min_respondents} respondents`} />}
                <Link href={`/faculty/results/${o.offering_id}`} className="text-sm font-semibold text-brand-600 hover:underline">Results</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
