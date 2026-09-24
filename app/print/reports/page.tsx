import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { readParams } from "@/lib/url";
import { completionRate, getAdminAnalytics, periodFilterLabel, resolveAnalyticsFilters } from "@/lib/analytics/admin";
import { getDepartments, getPeriods, getPrograms, getSettings } from "@/lib/data/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatNumber, formatRating } from "@/lib/format";
import { Logo } from "@/components/brand/Logo";
import { ratingLabel } from "@/components/ui/rating-display";
import { DistributionChart, SimpleBarChart, TrendChart } from "@/components/charts/charts";
import { CompletionTable, QuestionAveragesTable, TopFacultyTable } from "@/components/reports/report-tables";
import { PrintButton } from "@/components/reports/print-button";
import { logActivity } from "@/lib/activity";

export const metadata: Metadata = { title: "Printable Report" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-avoid mt-6">
      <h2 className="mb-2 border-b-2 border-brand-500 pb-1 text-base font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function PrintReportPage({ searchParams }: PageProps<"/print/reports">) {
  const user = await requireRole("admin");
  const params = await readParams(searchParams);
  const [periods, settings, departments, programs] = await Promise.all([getPeriods(), getSettings(), getDepartments(), getPrograms()]);
  const f = resolveAnalyticsFilters(params, periods);
  const a = await getAdminAnalytics(f);
  const supabase = await createClient();
  const [{ data: fac }, { data: subj }] = await Promise.all([
    f.faculty ? supabase.from("faculty_overview").select("full_name").eq("id", f.faculty).maybeSingle() : Promise.resolve({ data: null }),
    f.subject ? supabase.from("subjects").select("code, title").eq("id", f.subject).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const scale = settings.rating_scale;
  const max = scale.length;
  const k = a.kpis;
  const generated = new Date();
  const filters = [
    ["School Year", f.sy ? `S.Y. ${f.sy}-${f.sy + 1}` : "All"],
    ["Semester", f.sem ? (f.sem === 1 ? "1st Semester" : "2nd Semester") : "All"],
    ["Department", departments.find((d) => d.id === f.department)?.name ?? "All"],
    ["Program", programs.find((p) => p.id === f.program)?.code ?? "All"],
    ["Faculty", fac?.full_name ?? "All"],
    ["Subject", subj ? `${subj.code} – ${subj.title}` : "All"],
  ];
  await logActivity({ user, module: "Reports", action: "Generated printable report", description: periodFilterLabel(f) });

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-[13px] text-gray-800 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2"><PrintButton /></div>

      <header className="flex items-center justify-between gap-6 border-b-4 border-brand-500 pb-4">
        <Logo />
        <div className="text-right">
          <p className="text-base font-bold text-gray-900">{settings.institution_name}</p>
          {settings.institution_address && <p className="text-gray-600">{settings.institution_address}</p>}
          <p className="mt-1 text-lg font-bold text-brand-700">Faculty Evaluation Report</p>
          <p className="text-gray-600">{periodFilterLabel(f)}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1">
        {filters.map(([key, v]) => (
          <div key={key} className="flex gap-2"><dt className="font-semibold text-gray-600">{key}:</dt><dd>{v}</dd></div>
        ))}
        <div className="col-span-3 flex gap-2"><dt className="font-semibold text-gray-600">Generated:</dt><dd>{formatDateTime(generated)}</dd></div>
      </dl>

      <Section title="Summary">
        <div className="grid grid-cols-4 gap-3">
          {[
            ["Average rating", `${formatRating(k.average_rating)} / ${max}`, ratingLabel(k.average_rating, scale)],
            ["Completed", formatNumber(k.completed), `of ${formatNumber(k.expected)} expected`],
            ["Completion", `${completionRate(k.completed, k.expected)}%`, `${formatNumber(k.expected - k.completed)} pending`],
            ["Faculty evaluated", formatNumber(k.faculty_evaluated), `${formatNumber(k.offerings)} classes`],
          ].map(([l, v, h]) => (
            <div key={l} className="rounded border border-gray-300 p-2">
              <p className="text-[11px] font-semibold uppercase text-gray-500">{l}</p>
              <p className="text-lg font-bold">{v}</p>
              <p className="text-[11px] text-gray-500">{h}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Overall Evaluation Rating per Semester">
        <TrendChart data={a.rating_by_period.map((p) => ({ label: `${p.semester === 1 ? "1st" : "2nd"} ${p.start_year}`, average: p.average }))} xKey="label" series={[{ key: "average", label: "Average" }]} domain={[1, max]} height={220} />
      </Section>
      <Section title={`Top Performing Faculty (minimum ${a.min_respondents} respondents)`}><TopFacultyTable a={a} scale={scale} /></Section>
      <Section title="Evaluation Rating per Department">
        <SimpleBarChart data={a.by_department} xKey="code" yKey="average" name="Average" max={max} height={220} />
      </Section>
      <Section title="Percentage of Evaluation Completion per Department"><CompletionTable rows={a.participation_by_department} label="Department" /></Section>
      <Section title="Average Rating per Category">
        <SimpleBarChart data={a.categories} xKey="name" yKey="average" name="Average" horizontal max={max} />
      </Section>
      <Section title="Rating Distribution"><DistributionChart data={a.distribution} labels={scale.map((s) => s.label)} height={200} /></Section>
      <Section title="Average Rating by Faculty Age Range / Years of Service">
        <div className="grid grid-cols-2 gap-4">
          <SimpleBarChart data={a.age_ranges} xKey="label" yKey="average" name="Average" max={max} height={200} />
          <SimpleBarChart data={a.service_ranges} xKey="label" yKey="average" name="Average" max={max} height={200} />
        </div>
      </Section>
      <Section title="Average Score per Question"><QuestionAveragesTable a={a} /></Section>

      <footer className="print-avoid mt-10 grid grid-cols-2 gap-10">
        <div>
          <p className="text-gray-600">Prepared / generated by:</p>
          <p className="mt-8 border-t border-gray-800 pt-1 font-semibold">{user.displayName}</p>
          <p className="text-gray-600">System Administrator, ASSCAT iRATE</p>
        </div>
        <div>
          <p className="text-gray-600">Noted by:</p>
          <p className="mt-8 border-t border-gray-800 pt-1">&nbsp;</p>
          <p className="text-gray-600">Signature over printed name</p>
        </div>
      </footer>
      <p className="mt-6 text-center text-[11px] text-gray-500">
        Generated by ASSCAT iRATE on {formatDateTime(generated)}. Individual student responses are confidential and are not included in this report.
      </p>
    </div>
  );
}
