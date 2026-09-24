import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarClock, FileSpreadsheet, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPrograms, resolvePeriod } from "@/lib/data/lookups";
import { listQuery, likePattern, readParams } from "@/lib/url";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { SemesterSelector } from "@/components/ui/semester-selector";
import { EvaluationProgress } from "@/components/ui/evaluation-progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { AddOfferingButton } from "@/components/admin/survey/add-offering-button";
import { OfferingRowActions } from "@/components/admin/survey/offering-row-actions";
import { formatDateTime, semesterLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Survey" };

export default async function SurveysPage({ searchParams }: PageProps<"/admin/surveys">) {
  const params = await readParams(searchParams);
  const { periods, period } = await resolvePeriod(params.period);
  const lq = listQuery(params, { sortable: ["subject_code", "subject_title", "faculty_name", "progress_pct", "completed_count"], defaultSort: "subject_code" });
  const supabase = await createClient();

  let q = supabase.from("offering_overview").select("*", { count: "exact" }).eq("academic_period_id", period?.id ?? "00000000-0000-0000-0000-000000000000");
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (params.department) q = q.eq("department_id", params.department);
  if (params.program) q = q.eq("program_id", params.program);
  if (params.progress === "none") q = q.eq("completed_count", 0);
  if (params.progress === "partial") q = q.gt("completed_count", 0).lt("progress_pct", 100);
  if (params.progress === "complete") q = q.gte("progress_pct", 100);

  const [{ data, count }, departments, programs, { data: subjects }, { data: faculty }] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc" }).order("section").range(lq.from, lq.to),
    getDepartments(),
    getPrograms(),
    supabase.from("subjects").select("id, code, title").eq("is_active", true).order("code"),
    supabase.from("faculty_overview").select("id, faculty_number, sort_name, program_id").eq("is_active", true).order("sort_name"),
  ]);

  type Row = NonNullable<typeof data>[number];
  const columns: Column<Row>[] = [
    { key: "n", header: "#", hideOnMobile: true, className: "w-10 text-gray-400", cell: (r) => lq.from + (data ?? []).indexOf(r) + 1 },
    { key: "code", header: "Subject Code", sortKey: "subject_code", className: "whitespace-nowrap", cell: (r) => (
      <Link href={`/admin/surveys/${r.id}`} className="font-semibold text-gray-900 hover:text-brand-600">
        {r.subject_code}{r.section ? <span className="ml-1 text-xs font-normal text-gray-500">({r.section})</span> : null}
      </Link>
    ) },
    { key: "title", header: "Subject Title", sortKey: "subject_title", primary: true, cell: (r) => (
      <Link href={`/admin/surveys/${r.id}`} className="hover:text-brand-600"><span className="md:hidden font-semibold">{r.subject_code} — </span>{r.subject_title}</Link>
    ) },
    { key: "teacher", header: "Teacher", sortKey: "faculty_name", cell: (r) => r.faculty_name },
    { key: "sem", header: "Semester", className: "whitespace-nowrap", cell: (r) => semesterLabel(r.semester ?? 1) },
    { key: "sy", header: "School Year", className: "whitespace-nowrap", cell: (r) => r.school_year },
    { key: "progress", header: "Progress", sortKey: "progress_pct", cell: (r) => <EvaluationProgress completed={r.completed_count ?? 0} total={r.enrolled_count ?? 0} compact /> },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <OfferingRowActions id={r.id!} name={`${r.subject_code}${r.section ? ` (${r.section})` : ""} – ${r.faculty_name}`} completed={r.completed_count ?? 0} />
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Survey"
        description="Faculty evaluations per subject for the selected school year and semester."
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Survey" }]}
        actions={periods.length > 0 && period ? <SemesterSelector periods={periods} value={period.id} /> : undefined}
      />

      {!period ? (
        <Card><EmptyState title="No survey schedule yet" description="Create a school year and semester schedule to start." action={<Link href="/admin/settings?tab=schedule" className={buttonClasses()}>Schedule Survey</Link>} /></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <StatusBadge status={period.status === "closed" ? "expired" : period.status} label={period.status === "active" ? "Open" : period.status === "closed" ? "Closed" : "Upcoming"} />
              <span>{formatDateTime(period.open_at)} – {formatDateTime(period.close_at)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <AddOfferingButton
                period={{ id: period.id, label: period.label }}
                subjects={(subjects ?? []).map((s) => ({ id: s.id, label: `${s.code} – ${s.title}` }))}
                faculty={(faculty ?? []).map((f) => ({ id: f.id!, label: `${f.sort_name} (${f.faculty_number})`, program_id: f.program_id! }))}
                programs={programs.filter((p) => p.is_active).map((p) => ({ id: p.id, label: `${p.code} – ${p.name}` }))}
              />
              <Link href="/admin/surveys/import-course" className={buttonClasses("secondary")}><FileUp className="h-4 w-4" /> Import Course File</Link>
              <Link href="/admin/surveys/import-evaluations" className={buttonClasses("secondary")}><FileSpreadsheet className="h-4 w-4" /> Import Evaluation File</Link>
              <Link href="/admin/settings?tab=schedule" className={buttonClasses("secondary")}><CalendarClock className="h-4 w-4" /> Schedule Survey</Link>
              <Link href="/admin/subjects" className={buttonClasses("ghost")}><BookOpen className="h-4 w-4" /> Subjects</Link>
            </div>
          </div>

          {period.status === "upcoming" && <Alert tone="info" className="mb-4">This evaluation period has not opened yet. Students can evaluate starting {formatDateTime(period.open_at)}.</Alert>}

          <Card outline="brand">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <SearchInput placeholder="Search subject, teacher…" className="sm:col-span-2 lg:w-72" />
              <FilterSelect param="department" label="Department" options={departments.map((d) => ({ value: d.id, label: d.code }))} allLabel="All departments" className="lg:w-44" />
              <FilterSelect param="program" label="Program" options={programs.map((p) => ({ value: p.id, label: p.code }))} allLabel="All programs" className="lg:w-40" />
              <FilterSelect param="progress" label="Progress" options={[{ value: "none", label: "Not started" }, { value: "partial", label: "In progress" }, { value: "complete", label: "Complete" }]} className="lg:w-40" />
            </div>
            <DataTable columns={columns} rows={data ?? []} rowKey={(r) => r.id!} basePath="/admin/surveys" params={params} sort={lq.sort} dir={lq.dir}
              caption="List of evaluations"
              empty={<EmptyState title="No subjects in this survey" description={lq.q || params.program || params.department ? "Try changing the filters." : "Add a subject or import a course file."} />} />
            <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath="/admin/surveys" params={params} />
          </Card>
        </>
      )}
    </>
  );
}
