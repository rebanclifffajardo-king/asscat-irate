import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CheckCircle2, Clock, Hourglass, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPrograms } from "@/lib/data/lookups";
import { likePattern, listQuery, readParams } from "@/lib/url";
import { publicStorageUrl } from "@/lib/storage";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { RatingDisplay } from "@/components/ui/rating-display";
import { AnalyticsCard } from "@/components/ui/stat-card";
import { EvaluationProgress } from "@/components/ui/evaluation-progress";
import { EnrollStudentsButton } from "@/components/admin/survey/enroll-students-button";
import { EnrollmentRowActions } from "@/components/admin/survey/enrollment-row-actions";
import { semesterLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Evaluation Details" };

export default async function OfferingDetailPage({ params, searchParams }: PageProps<"/admin/surveys/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await readParams(searchParams);
  const supabase = await createClient();
  const { data: o } = await supabase.from("offering_overview").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();

  const lq = listQuery(sp, { sortable: ["student_number", "sort_name", "program_code", "year_level_order", "evaluation_status", "average_rating"], defaultSort: "sort_name", pageSize: 25 });
  let q = supabase.from("enrollment_overview").select("*", { count: "exact" }).eq("offering_id", id);
  if (lq.q) q = q.ilike("search_text", likePattern(lq.q));
  if (sp.status && ["pending", "in_progress", "completed"].includes(sp.status)) q = q.eq("evaluation_status", sp.status);

  const [{ data: rows, count }, { data: faculty }, programs] = await Promise.all([
    q.order(lq.sort, { ascending: lq.dir === "asc", nullsFirst: false }).order("student_number").range(lq.from, lq.to),
    supabase.from("faculty").select("faculty_number, email, photo_path").eq("id", o.faculty_id!).maybeSingle(),
    getPrograms(),
  ]);
  const pending = (o.enrolled_count ?? 0) - (o.completed_count ?? 0) - (o.in_progress_count ?? 0);

  const info: [string, React.ReactNode][] = [
    ["Faculty ID", <span key="fid" className="font-mono">{faculty?.faculty_number}</span>],
    ["Faculty Name", o.faculty_name],
    ["Email", faculty?.email],
    ["Subject Code", `${o.subject_code}${o.section ? ` (Section ${o.section})` : ""}`],
    ["Subject Title", o.subject_title],
    ["Program", `${o.program_code} – ${o.program_name}`],
    ["Department", `${o.department_code} – ${o.department_name}`],
    ["School Year", `S.Y. ${o.school_year}`],
    ["Semester", semesterLabel(o.semester ?? 1)],
  ];

  type Row = NonNullable<typeof rows>[number];
  const columns: Column<Row>[] = [
    { key: "sid", header: "Student ID", sortKey: "student_number", className: "whitespace-nowrap font-mono text-[13px]", cell: (r) => r.student_number },
    { key: "name", header: "Student Name", sortKey: "sort_name", primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.student_name}</span> },
    { key: "program", header: "Program", sortKey: "program_code", cell: (r) => r.program_code },
    { key: "year", header: "Year Level", sortKey: "year_level_order", className: "whitespace-nowrap", cell: (r) => r.year_level_name },
    { key: "status", header: "Status", sortKey: "evaluation_status", cell: (r) => (
      <StatusBadge status={r.evaluation_status === "in_progress" ? "ongoing" : r.evaluation_status!} />
    ) },
    { key: "score", header: "Evaluation Score", sortKey: "average_rating", cell: (r) => (r.evaluation_status === "completed" ? <RatingDisplay value={r.average_rating} showLabel={false} /> : <span className="text-gray-400">—</span>) },
    { key: "actions", header: "Action", isAction: true, className: "w-16 text-right", cell: (r) => (
      <EnrollmentRowActions enrollmentId={r.id!} offeringId={id} attemptId={r.attempt_id} studentName={r.student_name ?? ""} />
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Evaluation Details"
        breadcrumbs={[{ label: "Home", href: "/admin/dashboard" }, { label: "Survey", href: `/admin/surveys?period=${o.academic_period_id}` }, { label: `${o.subject_code}${o.section ? ` (${o.section})` : ""}` }]}
      />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card outline="brand" className="self-start">
          <CardHeader title="Teacher Information" />
          <div className="flex flex-col items-center px-4 pt-5 text-center">
            <FacultyAvatar name={o.faculty_name ?? ""} src={publicStorageUrl("faculty-photos", faculty?.photo_path)} size="xl" className="ring-brand-100" />
            <p className="mt-3 text-lg font-semibold text-gray-900">{o.faculty_name}</p>
            <p className="text-sm text-gray-500">{o.subject_code} — {o.subject_title}</p>
            <RatingDisplay className="mt-2" value={o.average_rating} size="md" />
          </div>
          <dl className="mt-4 divide-y divide-gray-100 border-t border-gray-100 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2">
                <dt className="shrink-0 text-gray-500">{k}</dt>
                <dd className="text-right font-medium text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <AnalyticsCard label="Enrolled Students" value={o.enrolled_count} icon={<Users />} tone="info" />
            <AnalyticsCard label="Completed" value={o.completed_count} icon={<CheckCircle2 />} tone="brand" progress={Number(o.progress_pct)} />
            <AnalyticsCard label="On-going" value={o.in_progress_count} icon={<Hourglass />} tone="warning" />
            <AnalyticsCard label="Pending" value={pending} icon={<Clock />} tone="danger" />
          </div>
          <Card>
            <CardHeader
              title="Students Under Subject"
              description={<EvaluationProgress completed={o.completed_count ?? 0} total={o.enrolled_count ?? 0} className="mt-1 max-w-xs" />}
              actions={<EnrollStudentsButton offeringId={id} programs={programs.map((p) => ({ id: p.id, code: p.code }))} defaultProgramId={o.program_id!} />}
            />
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <SearchInput placeholder="Search students…" />
              <FilterSelect param="status" label="Status" options={[{ value: "pending", label: "Pending" }, { value: "in_progress", label: "On-going" }, { value: "completed", label: "Completed" }]} className="sm:w-40" />
            </div>
            <DataTable columns={columns} rows={rows ?? []} rowKey={(r) => r.id!} basePath={`/admin/surveys/${id}`} params={sp} sort={lq.sort} dir={lq.dir}
              caption="Students under subject" empty={<EmptyState title="No students found" description={lq.q || sp.status ? "Try changing the filters." : "Enroll students so they can evaluate this class."} />} />
            <Pagination page={lq.page} pageSize={lq.pageSize} total={count ?? 0} basePath={`/admin/surveys/${id}`} params={sp} />
          </Card>
        </div>
      </div>
    </>
  );
}
