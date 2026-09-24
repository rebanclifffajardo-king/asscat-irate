import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/lookups";
import type { FacultyOffering } from "@/lib/analytics/faculty";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EvaluationProgress } from "@/components/ui/evaluation-progress";
import { RatingDisplay } from "@/components/ui/rating-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Evaluation Results" };

const VISIBILITY_TEXT = {
  immediate: "Results are visible as soon as enough students have submitted.",
  after_close: "Results become visible after each evaluation period closes.",
  manual: "Results become visible when released by the administrator.",
};

export default async function FacultyResultsPage() {
  await requireRole("faculty");
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([supabase.rpc("get_faculty_offerings"), getSettings()]);
  const offerings = (data ?? []) as FacultyOffering[];
  const byPeriod = new Map<string, FacultyOffering[]>();
  for (const o of offerings) byPeriod.set(o.period_label, [...(byPeriod.get(o.period_label) ?? []), o]);

  return (
    <>
      <PageHeader title="Evaluation Results" description="Aggregate, anonymous results for each class you handle."
        breadcrumbs={[{ label: "Home", href: "/faculty/dashboard" }, { label: "Evaluation Results" }]} />
      <Alert tone="info" className="mb-5">
        {VISIBILITY_TEXT[settings.results_visibility]} To protect anonymity, a class needs at least {settings.min_respondents} respondents before results are shown.
        Individual students are never identified.
      </Alert>
      {offerings.length === 0 ? <Card><EmptyState title="No classes yet" /></Card> : (
        <div className="space-y-5">
          {[...byPeriod.entries()].map(([label, list]) => (
            <Card key={label} outline={list[0].is_current ? "brand" : "none"}>
              <CardHeader title={label} description={list[0].is_current ? "Current semester" : undefined} />
              <ul className="divide-y divide-gray-100">
                {list.map((o) => {
                  const available = o.results_visible && o.meets_threshold;
                  return (
                    <li key={o.offering_id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_200px_180px_110px] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{o.subject_code}{o.section ? ` (${o.section})` : ""} — {o.subject_title}</p>
                        <p className="text-xs text-gray-500">{o.program_code}</p>
                      </div>
                      <EvaluationProgress completed={o.completed} total={o.enrolled} compact />
                      {available ? <RatingDisplay value={o.average} max={settings.rating_scale.length} showLabel={false} />
                        : <StatusBadge status="hidden" label={o.results_visible ? `Fewer than ${settings.min_respondents} respondents` : "Not yet released"} />}
                      {available ? (
                        <Link href={`/faculty/results/${o.offering_id}`} className="text-sm font-semibold text-brand-600 hover:underline">View results</Link>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
