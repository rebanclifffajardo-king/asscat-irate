import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EyeOff, MessageSquareText, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/lookups";
import { logActivity } from "@/lib/activity";
import { formatNumber, formatRating, semesterLabel } from "@/lib/format";
import type { OfferingResults } from "@/lib/analytics/faculty";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AnalyticsCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ratingLabel } from "@/components/ui/rating-display";
import { buttonClasses } from "@/components/ui/button";
import { ChartCard } from "@/components/charts/chart-card";
import { DistributionChart, SimpleBarChart } from "@/components/charts/charts";

export const metadata: Metadata = { title: "Evaluation Results" };

export default async function OfferingResultsPage({ params }: PageProps<"/faculty/results/[offeringId]">) {
  const user = await requireRole("faculty");
  const { offeringId } = await params;
  if (!z.uuid().safeParse(offeringId).success) notFound();
  const supabase = await createClient();
  // Ownership, release rules and the minimum-respondent threshold are enforced
  // inside get_offering_results; it never returns student identifiers.
  const [{ data, error }, settings] = await Promise.all([
    supabase.rpc("get_offering_results", { p_offering_id: offeringId }),
    getSettings(),
  ]);
  if (error || !data) notFound();
  const r = data as unknown as OfferingResults;
  const scale = settings.rating_scale;
  const o = r.offering;
  const title = `${o.subject_code}${o.section ? ` (${o.section})` : ""} — ${o.subject_title}`;

  if (r.visible) {
    await logActivity({ user, module: "Reports", action: "Viewed released evaluation results", description: `${o.subject_code} – ${o.period_label}`, entityType: "subject_offerings", entityId: offeringId });
  }

  const header = (
    <PageHeader title={title} description={`${semesterLabel(o.semester)} · S.Y. ${o.school_year} · ${o.program_code}`}
      breadcrumbs={[{ label: "Home", href: "/faculty/dashboard" }, { label: "Evaluation Results", href: "/faculty/results" }, { label: o.subject_code }]} />
  );

  if (!r.visible) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<EyeOff />}
            title={r.reason === "not_released" ? "Results not yet released" : "Not enough respondents"}
            description={r.reason === "not_released"
              ? "Results for this class will be available according to the institution's release policy."
              : `To protect student anonymity, results are shown only when at least ${r.min_respondents} students have submitted (currently ${r.respondents}).`}
            action={<Link href="/faculty/results" className={buttonClasses("secondary")}>Back to results</Link>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-3">
        <AnalyticsCard label="Number of respondents" value={`${formatNumber(r.respondents)} / ${formatNumber(r.enrolled)}`} icon={<Users />} tone="info" progress={r.enrolled ? (r.respondents / r.enrolled) * 100 : 0} />
        <AnalyticsCard label="Overall average" value={`${formatRating(r.overall_average)} / ${scale.length}`} icon={<Users />} tone="brand" hint={ratingLabel(r.overall_average, scale)} />
        <AnalyticsCard label="Anonymous comments" value={formatNumber(r.comments?.length ?? 0)} icon={<MessageSquareText />} tone="warning" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Category averages" empty={!r.categories?.length}
          table={{ columns: ["Category", "Average", "Responses"], rows: (r.categories ?? []).map((c) => [c.name, formatRating(c.average), c.responses]) }}>
          <SimpleBarChart data={r.categories ?? []} xKey="name" yKey="average" name="Average rating" horizontal max={scale.length} />
        </ChartCard>
        <ChartCard title="Rating distribution" empty={!r.distribution?.length}
          table={{ columns: ["Rating", "Answers"], rows: (r.distribution ?? []).map((d) => [`${d.rating} – ${scale[d.rating - 1]?.label ?? ""}`, d.count]) }}>
          <DistributionChart data={r.distribution ?? []} labels={scale.map((s) => s.label)} />
        </ChartCard>
      </div>

      <Card className="mt-5">
        <CardHeader title="Question-level averages" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
              <tr><th className="px-4 py-2">Category</th><th className="px-4 py-2">Question</th><th className="px-4 py-2 text-right">Average</th><th className="px-4 py-2">Equivalent</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(r.questions ?? []).map((q, i, all) => {
                const show = i === 0 || all[i - 1].category !== q.category;
                return (
                  <tr key={i}>
                    <td className="px-4 py-2 align-top font-semibold text-gray-800">{show ? q.category : ""}</td>
                    <td className="px-4 py-2 text-gray-700">{q.content}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatRating(q.average)}</td>
                    <td className="px-4 py-2 text-gray-600">{ratingLabel(q.average, scale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Anonymous comments" description="Shown in random order without names or dates." />
        <CardBody>
          {r.comments?.length ? (
            <ul className="space-y-3">
              {r.comments.map((c, i) => (
                <li key={i} className="flex gap-3 rounded-md border-l-4 border-brand-500 bg-gray-50 p-3 text-sm text-gray-800">
                  <MessageSquareText className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                  <p className="whitespace-pre-wrap">{c}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No comments" className="py-6" />}
        </CardBody>
      </Card>
    </>
  );
}
